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
 * Synchronise le classement des buteurs à partir des `goalscorers` des matchs
 * terminés (source alimentée par API-Football `/fixtures/events`).
 * N'appelle plus l'endpoint payant `/players/topscorers` → plus d'erreur
 * "unauthorized". Les colonnes `goals`/`assists`/`api_player_id` de la table
 * `players` sont mises à jour par matching nom normalisé / api_player_id.
 */
export const syncTopScorersNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<TopScorersSyncResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: matches, error: mErr } = await supabaseAdmin
      .from("matches")
      .select("goalscorers")
      .eq("finished", true);
    if (mErr) {
      return { ok: false, fetched: 0, updated: 0, syncedAt: new Date().toISOString(), error: mErr.message };
    }

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

    const { data: dbPlayers } = await supabaseAdmin.from("players").select("id, name, api_player_id");
    const byApiId = new Map<number, { id: string; name: string }>();
    const byName = new Map<string, { id: string; name: string }>();
    for (const p of dbPlayers || []) {
      if (p.api_player_id) byApiId.set(p.api_player_id, p as any);
      byName.set(norm(p.name), p as any);
    }

    let updated = 0;
    const matched = new Set<string>();
    for (const s of agg.values()) {
      const target = (s.apiPlayerId && byApiId.get(s.apiPlayerId)) || byName.get(norm(s.name));
      if (!target) continue;
      matched.add(target.id);
      const patch: { goals: number; assists: number; api_player_id?: number } = { goals: s.goals, assists: s.assists };
      if (s.apiPlayerId) patch.api_player_id = s.apiPlayerId;
      const { error } = await supabaseAdmin.from("players").update(patch).eq("id", target.id);
      if (!error) updated += 1;
    }

    if (matched.size > 0) {
      await supabaseAdmin
        .from("players")
        .update({ goals: 0, assists: 0 })
        .not("id", "in", `(${[...matched].map((id) => `"${id}"`).join(",")})`)
        .gt("goals", 0);
    }

    return { ok: true, fetched: agg.size, updated, syncedAt: new Date().toISOString() };
  });
