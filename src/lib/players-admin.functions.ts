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
      .select("id, name, club, goals, assists, api_player_id, team_id, position, teams:team_id(name, code)")
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

export const listTeamsAsUnitAdminFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, code")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPlayerAsUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z
      .object({
        team_id: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        club: z.string().trim().max(80).optional().nullable(),
        position: z.enum(["GK", "DF", "MF", "FW"]).default("FW"),
        goals: z.number().int().min(0).max(99).default(0),
        assists: z.number().int().min(0).max(99).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("players")
      .insert({
        team_id: data.team_id,
        name: data.name,
        club: data.club || null,
        position: data.position,
        goals: data.goals,
        assists: data.assists,
        is_top_scorer: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id };
  });

export const deletePlayerAsUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("players").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
