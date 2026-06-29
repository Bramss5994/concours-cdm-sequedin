import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnitAdmin, SUPER_ADMIN_DEPOT } from "./unit-admin.functions";

export const listPlayersAsUnitAdminFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("id, name, club, goals, assists, api_player_id, team_id, teams:team_id(name, code)")
      .order("goals", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updatePlayerStatsAsUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        goals: z.number().int().min(0).max(99),
        assists: z.number().int().min(0).max(99),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("players")
      .update({ goals: data.goals, assists: data.assists })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
