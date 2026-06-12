import { createFileRoute } from "@tanstack/react-router";
import { kickoffKeyFromISO, type GoalEvent } from "@/lib/livescores.shared";

const MAX_EVENT_FETCHES_PER_RUN = 2;
const EVENT_FETCH_DELAY_MS = 8_000;

/**
 * Agent IA "mise à jour des scores".
 * Endpoint public déclenché par pg_cron toutes les 15 minutes.
 *
 * Pour chaque match CDM 2026 :
 *  - associe l'api_fixture_id (une fois pour toutes, par horaire UTC + noms d'équipes)
 *  - pour les matchs qui viennent de se terminer : récupère quelques buteurs via /fixtures/events
 *    sans dépasser la limite API, et les stocke dans matches.goalscorers (JSONB)
 *  - pour les matchs terminés (FT / AET / PEN) : met à jour score_a, score_b, finished
 *    → le trigger matches_after_result recalcule alors les points.
 *
 * Sécurité : header apikey = clé publique backend.
 */
export const Route = createFileRoute("/api/public/hooks/sync-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dmdpcWVjdW5jZG9rb2tjb3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTY5NzEsImV4cCI6MjA5NTM5Mjk3MX0.XHnWY51wmKLV558Oib2F-FUhgovzRB6Kgyc-yoiwh6M";
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { fetchLiveScores, fetchFixtureEvents } = await import("@/lib/livescores.server");

        const live = await fetchLiveScores();
        if (live.error) {
          return Response.json({ ok: false, error: live.error }, { status: 502 });
        }

        const { data: dbMatches, error: dbErr } = await supabaseAdmin
          .from("matches")
          .select(
            "id, kickoff_at, finished, score_a, score_b, api_fixture_id, goalscorers, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)",
          );
        if (dbErr) {
          return Response.json({ ok: false, error: dbErr.message }, { status: 500 });
        }

        // Index fixtures par clé d'horaire UTC
        const byKickoff = new Map<string, typeof live.fixtures>();
        for (const f of live.fixtures) {
          const arr = byKickoff.get(f.kickoffKey) || [];
          arr.push(f);
          byKickoff.set(f.kickoffKey, arr);
        }

        const scoreUpdates: any[] = [];
        const goalUpdates: any[] = [];
        const errors: string[] = [];
        let eventFetches = 0;

        for (const m of dbMatches || []) {
          const key = kickoffKeyFromISO(m.kickoff_at);
          const candidates = byKickoff.get(key);
          if (!candidates || candidates.length === 0) continue;

          const nameA = ((m.team_a as any)?.name || "").toLowerCase();
          const nameB = ((m.team_b as any)?.name || "").toLowerCase();
          const pick =
            candidates.length === 1
              ? candidates[0]
              : candidates.find((c) => {
                  const ha = c.teamHome.toLowerCase();
                  const hb = c.teamAway.toLowerCase();
                  return (
                    (nameA && (ha.startsWith(nameA.slice(0, 3)) || nameA.startsWith(ha.slice(0, 3)))) ||
                    (nameB && (hb.startsWith(nameB.slice(0, 3)) || nameB.startsWith(hb.slice(0, 3))))
                  );
                }) || candidates[0];

          // 1) sauve l'api_fixture_id si absent
          if (!m.api_fixture_id) {
            const { error: e } = await supabaseAdmin
              .from("matches")
              .update({ api_fixture_id: pick.apiFixtureId })
              .eq("id", m.id);
            if (e) errors.push(`fixtureId ${m.id}: ${e.message}`);
          }

          // 2) buteurs : uniquement lorsqu'un match vient de se terminer, avec
          //    un plafond strict par exécution pour éviter la limite API.
          const hasGoalscorers =
            Array.isArray((m as any).goalscorers) && (m as any).goalscorers.length > 0;
          // Retente tant que les buteurs ne sont pas peuplés, même si le match
          // est déjà marqué finished (les fetches sont plafonnés par run).
          const needsFinalEvents = pick.isFinished && !hasGoalscorers;
          const needEvents = needsFinalEvents && eventFetches < MAX_EVENT_FETCHES_PER_RUN;
          if (needEvents) {
            eventFetches += 1;
            if (eventFetches > 1) {
              await new Promise((r) => setTimeout(r, EVENT_FETCH_DELAY_MS));
            }
            const ev = await fetchFixtureEvents(pick.apiFixtureId);
            if (ev.error) {
              errors.push(`events ${m.id}: ${ev.error}`);
            } else {
              const payload = ev.goals.map((g: GoalEvent) => ({
                minute: g.minute,
                extra: g.extra,
                team: g.team,
                player: g.player,
                api_player_id: g.apiPlayerId,
                assist: g.assist,
                type: g.type,
              }));
              const { error: e } = await supabaseAdmin
                .from("matches")
                .update({ goalscorers: payload })
                .eq("id", m.id);
              if (e) errors.push(`goalscorers ${m.id}: ${e.message}`);
              else goalUpdates.push({ id: m.id, count: payload.length });
            }
          } else if (needsFinalEvents) {
            errors.push(`events ${m.id}: reporté pour respecter la limite API`);
          }

          // 4) score final pour les matchs terminés non encore validés

          if (
            pick.isFinished &&
            pick.scoreHome !== null &&
            pick.scoreAway !== null &&
            !m.finished
          ) {
            const { error: e } = await supabaseAdmin
              .from("matches")
              .update({ score_a: pick.scoreHome, score_b: pick.scoreAway, finished: true })
              .eq("id", m.id);
            if (e) errors.push(`score ${m.id}: ${e.message}`);
            else
              scoreUpdates.push({
                id: m.id,
                score_a: pick.scoreHome,
                score_b: pick.scoreAway,
                match: `${pick.teamHome} ${pick.scoreHome}-${pick.scoreAway} ${pick.teamAway}`,
              });
          }
        }

        return Response.json({
          ok: true,
          checkedFixtures: live.fixtures.length,
          checkedDbMatches: (dbMatches || []).length,
          updated: scoreUpdates.length,
          scoreUpdates: scoreUpdates.length,
          goalUpdates: goalUpdates.length,
          eventFetches,
          scoreDetails: scoreUpdates,
          errors,
          syncedAt: new Date().toISOString(),
        });
      },
    },
  },
});
