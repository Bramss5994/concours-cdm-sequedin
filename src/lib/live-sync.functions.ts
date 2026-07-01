import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { kickoffKeyFromISO, pickFixtureByTeams } from "./livescores.shared";

export type LiveSyncResult = {
  ok: boolean;
  liveFixtures: number;
  updatedMatches: number;
  goalUpdates: number;
  syncedAt: string;
  error?: string;
};

/**
 * Synchronise les matchs en direct depuis l'API : score, statut (HT, ET, P),
 * temps écoulé, scores prolongation/tirs au but et buteurs.
 * Appelable par n'importe quel utilisateur authentifié (poll côté UI).
 */
export const syncLiveNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<LiveSyncResult> => {
    const { fetchLiveOnly, fetchFixtureEvents } = await import("./livescores.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const live = await fetchLiveOnly();
    if (live.error) {
      return {
        ok: false,
        liveFixtures: 0,
        updatedMatches: 0,
        goalUpdates: 0,
        syncedAt: new Date().toISOString(),
        error: live.error,
      };
    }

    if (live.fixtures.length === 0) {
      return {
        ok: true,
        liveFixtures: 0,
        updatedMatches: 0,
        goalUpdates: 0,
        syncedAt: new Date().toISOString(),
      };
    }

    const { data: dbMatches } = await supabaseAdmin
      .from("matches")
      .select(
        "id, kickoff_at, api_fixture_id, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)",
      );

    const byFixtureId = new Map<number, (typeof live.fixtures)[number]>();
    const byKickoff = new Map<string, (typeof live.fixtures)[number][]>();
    for (const f of live.fixtures) {
      byFixtureId.set(f.apiFixtureId, f);
      const arr = byKickoff.get(f.kickoffKey) || [];
      arr.push(f);
      byKickoff.set(f.kickoffKey, arr);
    }

    let updated = 0;
    let goalUpdates = 0;

    for (const m of dbMatches || []) {
      let pick = m.api_fixture_id ? byFixtureId.get(m.api_fixture_id) : undefined;
      if (!pick) {
        const cands = byKickoff.get(kickoffKeyFromISO(m.kickoff_at));
        if (cands && cands.length > 0) {
          const na = ((m.team_a as any)?.name || "").toLowerCase();
          const nb = ((m.team_b as any)?.name || "").toLowerCase();
          pick =
            cands.find((c) => {
              const ha = c.teamHome.toLowerCase();
              const hb = c.teamAway.toLowerCase();
              return (
                (na && (ha.startsWith(na.slice(0, 3)) || na.startsWith(ha.slice(0, 3)))) ||
                (nb && (hb.startsWith(nb.slice(0, 3)) || nb.startsWith(hb.slice(0, 3))))
              );
            }) || cands[0];
        }
      }
      if (!pick) continue;

      const patch: any = {
        live_status: pick.status,
        live_elapsed: pick.elapsed,
        live_score_a: pick.scoreHome,
        live_score_b: pick.scoreAway,
      };
      if (pick.scoreHomeET != null) patch.score_a_et = pick.scoreHomeET;
      if (pick.scoreAwayET != null) patch.score_b_et = pick.scoreAwayET;
      if (pick.scoreHomePEN != null) patch.score_a_pen = pick.scoreHomePEN;
      if (pick.scoreAwayPEN != null) patch.score_b_pen = pick.scoreAwayPEN;
      if (!m.api_fixture_id) patch.api_fixture_id = pick.apiFixtureId;

      const { error: e } = await supabaseAdmin.from("matches").update(patch).eq("id", m.id);
      if (!e) updated += 1;

      // Buteurs en direct (un seul fetch par match live)
      try {
        const ev = await fetchFixtureEvents(pick.apiFixtureId);
        if (!ev.error) {
          const { sideOfGoal, dedupeGoals } = await import("./bracket-sync.functions");
          const fx = { home: pick.teamHome, away: pick.teamAway };
          const dbTeams = { a: (m.team_a as any)?.name, b: (m.team_b as any)?.name };
          const payload = dedupeGoals(
            ev.goals.map((g) => ({
              minute: g.minute,
              extra: g.extra,
              team: g.team,
              player: g.player,
              api_player_id: g.apiPlayerId,
              assist: g.assist,
              type: g.type,
              side: sideOfGoal(g.team, dbTeams, fx),
            })),
          );
          await supabaseAdmin.from("matches").update({ goalscorers: payload }).eq("id", m.id);
          goalUpdates += 1;
        }
      } catch {
        // ignore
      }
    }

    return {
      ok: true,
      liveFixtures: live.fixtures.length,
      updatedMatches: updated,
      goalUpdates,
      syncedAt: new Date().toISOString(),
    };
  });
