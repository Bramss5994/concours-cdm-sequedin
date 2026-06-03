import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getLiveScores, kickoffKeyFromISO } from "@/lib/livescores.functions";

/**
 * Agent IA "mise à jour des scores".
 * Endpoint public déclenché par pg_cron toutes les 15 minutes.
 * Récupère les fixtures CDM 2026 via API-Football, et pour chaque match
 * terminé (FT / AET / PEN) met à jour score_a, score_b, finished dans la
 * table matches. Le trigger matches_after_result recalcule alors les points.
 *
 * Sécurité : vérifie l'apikey publishable Supabase (cf. pattern pg_cron + apikey).
 */
export const Route = createFileRoute("/api/public/hooks/sync-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-webhook-secret");
        const expected = process.env.SYNC_WEBHOOK_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const live = await getLiveScores();
        if (live.error) {
          return Response.json({ ok: false, error: live.error }, { status: 502 });
        }

        // Garder seulement les matchs terminés (résultat définitif).
        const finished = live.fixtures.filter(
          (f) => f.isFinished && f.scoreHome !== null && f.scoreAway !== null,
        );

        // Charger les matchs non encore validés.
        const { data: dbMatches, error: dbErr } = await supabaseAdmin
          .from("matches")
          .select("id, kickoff_at, finished, score_a, score_b, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)")
          .eq("finished", false);
        if (dbErr) {
          return Response.json({ ok: false, error: dbErr.message }, { status: 500 });
        }

        const updates: Array<{ id: string; score_a: number; score_b: number; match: string }> = [];
        const errors: string[] = [];

        // Index des fixtures terminées par clé d'horaire UTC (minute).
        const byKickoff = new Map<string, typeof finished>();
        for (const f of finished) {
          const arr = byKickoff.get(f.kickoffKey) || [];
          arr.push(f);
          byKickoff.set(f.kickoffKey, arr);
        }

        for (const m of dbMatches || []) {
          const key = kickoffKeyFromISO(m.kickoff_at);
          const candidates = byKickoff.get(key);
          if (!candidates || candidates.length === 0) continue;

          // S'il y a plusieurs matchs au même horaire, on tente d'apparier
          // par nom d'équipe (en comparant les premiers caractères, FR vs EN).
          const nameA = (m.team_a as any)?.name?.toLowerCase() || "";
          const nameB = (m.team_b as any)?.name?.toLowerCase() || "";
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

          const { error: upErr } = await supabaseAdmin
            .from("matches")
            .update({
              score_a: pick.scoreHome!,
              score_b: pick.scoreAway!,
              finished: true,
            })
            .eq("id", m.id);
          if (upErr) {
            errors.push(`${m.id}: ${upErr.message}`);
          } else {
            updates.push({
              id: m.id,
              score_a: pick.scoreHome!,
              score_b: pick.scoreAway!,
              match: `${pick.teamHome} ${pick.scoreHome}-${pick.scoreAway} ${pick.teamAway}`,
            });
          }
        }

        return Response.json({
          ok: true,
          checkedFixtures: finished.length,
          checkedDbMatches: (dbMatches || []).length,
          updated: updates.length,
          updates,
          errors,
          syncedAt: new Date().toISOString(),
        });
      },
    },
  },
});
