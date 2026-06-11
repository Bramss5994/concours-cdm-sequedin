import { createFileRoute } from "@tanstack/react-router";

/**
 * Agent IA "mise à jour des buteurs".
 * Endpoint public déclenché par pg_cron 1×/jour pendant le tournoi.
 *
 * Récupère le classement des meilleurs buteurs CDM 2026 via API-Football
 * et met à jour les colonnes `goals`, `assists` et `api_player_id` de la
 * table `players` (matching par nom normalisé, fallback insensible aux
 * accents et à la casse).
 *
 * Sécurité : header apikey = clé publique backend.
 */
export const Route = createFileRoute("/api/public/hooks/sync-topscorers")({
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
        const { fetchTopScorers } = await import("@/lib/livescores.server");

        const top = await fetchTopScorers();
        if (top.error) {
          return Response.json({ ok: false, error: top.error }, { status: 502 });
        }

        const { data: dbPlayers, error: dbErr } = await supabaseAdmin
          .from("players")
          .select("id, name, api_player_id");
        if (dbErr) {
          return Response.json({ ok: false, error: dbErr.message }, { status: 500 });
        }

        const norm = (s: string) =>
          s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

        // Index par api_player_id et par nom normalisé
        const byApiId = new Map<number, { id: string; name: string }>();
        const byName = new Map<string, { id: string; name: string }>();
        for (const p of dbPlayers || []) {
          if (p.api_player_id) byApiId.set(p.api_player_id, p);
          byName.set(norm(p.name), p);
        }

        const updates: { player: string; goals: number; assists: number }[] = [];
        const errors: string[] = [];
        const matchedIds = new Set<string>();

        for (const s of top.scorers) {
          let target = byApiId.get(s.apiPlayerId);
          if (!target) {
            target = byName.get(norm(s.name));
          }
          if (!target) continue;

          matchedIds.add(target.id);
          const { error } = await supabaseAdmin
            .from("players")
            .update({
              api_player_id: s.apiPlayerId,
              goals: s.goals,
              assists: s.assists,
            })
            .eq("id", target.id);
          if (error) errors.push(`${target.name}: ${error.message}`);
          else updates.push({ player: target.name, goals: s.goals, assists: s.assists });
        }

        // Reset goals=0 for players not in the top scorer list (so old data doesn't stick)
        if (matchedIds.size > 0) {
          const { error } = await supabaseAdmin
            .from("players")
            .update({ goals: 0, assists: 0 })
            .not("id", "in", `(${[...matchedIds].map((id) => `"${id}"`).join(",")})`)
            .gt("goals", 0);
          if (error) errors.push(`reset: ${error.message}`);
        }

        return Response.json({
          ok: true,
          fetchedScorers: top.scorers.length,
          matchedDbPlayers: updates.length,
          updates,
          errors,
          syncedAt: new Date().toISOString(),
        });
      },
    },
  },
});
