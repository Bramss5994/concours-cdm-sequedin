import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopScorersSyncResult = {
  ok: boolean;
  fetched: number;
  updated: number;
  syncedAt: string;
  error?: string;
};

/**
 * Synchronise le classement des buteurs depuis API-Football.
 * Appelable par n'importe quel utilisateur authentifié pour un rafraîchissement
 * quasi temps réel côté UI. Le trafic est limité côté client (polling ~60s).
 */
export const syncTopScorersNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<TopScorersSyncResult> => {
    const { fetchTopScorers } = await import("./livescores.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const top = await fetchTopScorers();
    if (top.error) {
      return { ok: false, fetched: 0, updated: 0, syncedAt: new Date().toISOString(), error: top.error };
    }

    const { data: dbPlayers } = await supabaseAdmin.from("players").select("id, name, api_player_id");

    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const byApiId = new Map<number, { id: string; name: string }>();
    const byName = new Map<string, { id: string; name: string }>();
    for (const p of dbPlayers || []) {
      if (p.api_player_id) byApiId.set(p.api_player_id, p as any);
      byName.set(norm(p.name), p as any);
    }

    let updated = 0;
    const matched = new Set<string>();
    for (const s of top.scorers) {
      const target = byApiId.get(s.apiPlayerId) || byName.get(norm(s.name));
      if (!target) continue;
      matched.add(target.id);
      const { error } = await supabaseAdmin
        .from("players")
        .update({ api_player_id: s.apiPlayerId, goals: s.goals, assists: s.assists })
        .eq("id", target.id);
      if (!error) updated += 1;
    }

    if (matched.size > 0) {
      await supabaseAdmin
        .from("players")
        .update({ goals: 0, assists: 0 })
        .not("id", "in", `(${[...matched].map((id) => `"${id}"`).join(",")})`)
        .gt("goals", 0);
    }

    return { ok: true, fetched: top.scorers.length, updated, syncedAt: new Date().toISOString() };
  });
