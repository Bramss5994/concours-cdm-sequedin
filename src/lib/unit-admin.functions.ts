import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type UnitAdminSession = { depot: string; login_code: string };

function sessionConfig() {
  const password = process.env.UNIT_ADMIN_COOKIE_SECRET;
  if (!password || password.length < 32) {
    throw new Error("UNIT_ADMIN_COOKIE_SECRET is missing or too short (min 32 chars)");
  }
  return {
    password,
    name: "unit_admin_session",
    maxAge: 60 * 60 * 8, // 8h
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export const requireUnitAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const session = await useSession<UnitAdminSession>(sessionConfig());
    if (!session.data?.depot || !session.data?.login_code) {
      throw new Error("Unauthorized: unit admin session required");
    }
    return next({
      context: {
        depot: session.data.depot,
        loginCode: session.data.login_code,
      },
    });
  },
);

const DEPOTS = ["sequedin", "faidherbe", "wattrelos", "pc_bus", "tram"] as const;

export const loginUnitAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        login_code: z.string().min(3).max(32),
        password: z.string().min(1).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const code = data.login_code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyPassword } = await import("./unit-admin-crypto.server");

    const { data: row, error } = await supabaseAdmin
      .from("unit_admins")
      .select("depot, login_code, password_hash, active")
      .eq("login_code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row || !row.active) throw new Error("Identifiants invalides");

    const ok = await verifyPassword(data.password, row.password_hash);
    if (!ok) throw new Error("Identifiants invalides");

    const session = await useSession<UnitAdminSession>(sessionConfig());
    await session.update({ depot: row.depot as string, login_code: row.login_code });
    return { ok: true, depot: row.depot, login_code: row.login_code };
  });

export const logoutUnitAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<UnitAdminSession>(sessionConfig());
  await session.clear();
  return { ok: true };
});

export const getUnitAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<UnitAdminSession>(sessionConfig());
  if (!session.data?.depot) return null;
  return { depot: session.data.depot, login_code: session.data.login_code };
});

/* -------------------- Participant management (own depot) -------------------- */

export const listUnitParticipantsFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: e1 }, { data: preds, error: e2 }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, prenom, num_paie, email, depot, active, created_at")
        .eq("depot", context.depot as any)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("predictions").select("user_id, points"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const ids = new Set((profiles ?? []).map((p) => p.id));
    const pointsBy = new Map<string, number>();
    for (const p of preds ?? []) {
      if (!ids.has(p.user_id)) continue;
      pointsBy.set(p.user_id, (pointsBy.get(p.user_id) || 0) + (p.points || 0));
    }
    return (profiles ?? []).map((p) => ({ ...p, points: pointsBy.get(p.id) || 0 }));
  });

export const toggleUnitParticipantFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("depot")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof || prof.depot !== context.depot) throw new Error("Participant hors de votre unité");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUnitParticipantPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), newPassword: z.string().min(8).max(128) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("depot")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof || prof.depot !== context.depot) throw new Error("Participant hors de votre unité");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUnitParticipantFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("depot")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof || prof.depot !== context.depot) throw new Error("Participant hors de votre unité");
    await supabaseAdmin.from("predictions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Silence unused warning if tree-shaken
export const __DEPOTS = DEPOTS;
