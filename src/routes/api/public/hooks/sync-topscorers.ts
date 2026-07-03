import { createFileRoute } from "@tanstack/react-router";

/**
 * Agent IA "mise à jour des buteurs".
 * Endpoint public déclenché par pg_cron.
 *
 * Agrège les buteurs à partir des `goalscorers` des matchs terminés
 * (source alimentée par API-Football `/fixtures/events`) et met à jour
 * la table `players` (goals/assists). N'appelle plus l'endpoint payant
 * `/players/topscorers`.
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

        const { data: matches, error: mErr } = await supabaseAdmin
          .from("matches")
          .select("goalscorers")
          .eq("finished", true);
        if (mErr) return Response.json({ ok: false, error: mErr.message }, { status: 500 });

        const norm = (s: string) =>
          s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

        type Agg = { name: string; apiPlayerId: number | null; goals: number; assists: number };
        const agg = new Map<string, Agg>();
        for (const m of (matches || []) as any[]) {
          const gs = Array.isArray(m.goalscorers) ? m.goalscorers : [];
          for (const g of gs) {
            if (!g?.player) continue;
            if (g.type === "own") continue;
            const key = g.api_player_id ? `id:${g.api_player_id}` : `n:${norm(g.player)}`;
            const cur = agg.get(key) || { name: g.player, apiPlayerId: g.api_player_id ?? null, goals: 0, assists: 0 };
            cur.goals += 1;
            agg.set(key, cur);
            if (g.assist) {
              const akey = `n:${norm(g.assist)}`;
              const acur = agg.get(akey) || { name: g.assist, apiPlayerId: null, goals: 0, assists: 0 };
              acur.assists += 1;
              agg.set(akey, acur);
            }
          }
        }

        const { data: dbPlayers, error: dbErr } = await supabaseAdmin
          .from("players")
          .select("id, name, api_player_id");
        if (dbErr) return Response.json({ ok: false, error: dbErr.message }, { status: 500 });

        const byApiId = new Map<number, { id: string; name: string }>();
        const byName = new Map<string, { id: string; name: string }>();
        for (const p of dbPlayers || []) {
          if (p.api_player_id) byApiId.set(p.api_player_id, p);
          byName.set(norm(p.name), p);
        }

        const updates: { player: string; goals: number; assists: number }[] = [];
        const errors: string[] = [];
        const matchedIds = new Set<string>();

        for (const s of agg.values()) {
          const target = (s.apiPlayerId && byApiId.get(s.apiPlayerId)) || byName.get(norm(s.name));
          if (!target) continue;
          matchedIds.add(target.id);
          const patch: Record<string, unknown> = { goals: s.goals, assists: s.assists };
          if (s.apiPlayerId) patch.api_player_id = s.apiPlayerId;
          const { error } = await supabaseAdmin.from("players").update(patch).eq("id", target.id);
          if (error) errors.push(`${target.name}: ${error.message}`);
          else updates.push({ player: target.name, goals: s.goals, assists: s.assists });
        }

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
          aggregatedScorers: agg.size,
          matchedDbPlayers: updates.length,
          updates,
          errors,
          syncedAt: new Date().toISOString(),
        });
      },
    },
  },
});
