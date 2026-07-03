import { createFileRoute } from "@tanstack/react-router";

/**
 * Agent IA "mise à jour des buteurs".
 * Endpoint public déclenché par pg_cron.
 *
 * Agrège les buteurs uniquement à partir des `goalscorers` renseignés sur les
 * matchs terminés et met à jour la table `players` (goals/assists). Aucun appel
 * au classement des buteurs d'une API externe.
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
        const { syncTopScorersFromFinishedMatches } = await import("@/lib/topscorers-sync.server");

        try {
          return Response.json(await syncTopScorersFromFinishedMatches(supabaseAdmin));
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Erreur de synchronisation" },
            { status: 500 },
          );
        }
      },
    },
  },
});
