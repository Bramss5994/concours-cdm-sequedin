import { createServerFn } from "@tanstack/react-start";
import { requireUnitAdmin } from "./unit-admin.functions";

export type TopScorersSyncResult = {
  ok: boolean;
  fetched: number;
  updated: number;
  created: number;
  reset: number;
  syncedAt: string;
  error?: string;
};

/**
 * Synchronise le classement des buteurs à partir des `goalscorers` des matchs
 * terminés. Aucun appel au classement des buteurs d'une API externe : la source
 * de vérité est uniquement ce qui est renseigné sur chaque match terminé.
 * Auth : session unit-admin (panel /unite), pas Supabase Auth.
 */
export const syncTopScorersNowFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .handler(async (): Promise<TopScorersSyncResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncTopScorersFromFinishedMatches } = await import("./topscorers-sync.server");

    try {
      const result = await syncTopScorersFromFinishedMatches(supabaseAdmin);
      return {
        ok: true,
        fetched: result.aggregatedScorers,
        updated: result.matchedDbPlayers,
        created: result.createdDbPlayers,
        reset: result.resetDbPlayers,
        syncedAt: result.syncedAt,
        error: result.errors.length ? result.errors.join(" · ") : undefined,
      };
    } catch (e) {
      return {
        ok: false,
        fetched: 0,
        updated: 0,
        created: 0,
        reset: 0,
        syncedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : "Erreur de synchronisation",
      };
    }
  });
