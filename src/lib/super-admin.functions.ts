import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEPOT = z.enum(["sequedin", "faidherbe", "wattrelos", "pc_bus", "tram"]);

async function assertSequedinSuperAdmin(supabase: any, userId: string) {
  const { data: roleData, error: e1 } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!roleData) throw new Error("Forbidden: admin required");
  const { data: prof, error: e2 } = await supabase
    .from("profiles")
    .select("depot")
    .eq("id", userId)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!prof || prof.depot !== "sequedin") {
    throw new Error("Forbidden: super-admin (Sequedin) requis");
  }
}

export const listUnitAdminsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSequedinSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("unit_admins")
      .select("id, depot, login_code, active, created_at, updated_at")
      .order("depot")
      .order("login_code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        depot: DEPOT,
        login_code: z
          .string()
          .min(3)
          .max(32)
          .regex(/^[A-Za-z0-9_-]+$/, "Lettres, chiffres, tirets uniquement"),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSequedinSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword } = await import("./unit-admin-crypto.server");
    const code = data.login_code.toUpperCase();
    const password_hash = await hashPassword(data.password);
    const { error } = await supabaseAdmin.from("unit_admins").insert({
      depot: data.depot,
      login_code: code,
      password_hash,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUnitAdminPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSequedinSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPassword } = await import("./unit-admin-crypto.server");
    const password_hash = await hashPassword(data.password);
    const { error } = await supabaseAdmin
      .from("unit_admins")
      .update({ password_hash })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSequedinSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("unit_admins")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSequedinSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("unit_admins").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isSequedinSuperAdminFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await assertSequedinSuperAdmin(context.supabase, context.userId);
      return true;
    } catch {
      return false;
    }
  });
