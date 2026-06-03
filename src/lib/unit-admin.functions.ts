import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { z } from "zod";

type UnitAdminSession = { depot: string; login_code: string };

function getSessionPassword() {
  const explicitSecret = process.env.UNIT_ADMIN_COOKIE_SECRET;
  if (explicitSecret && explicitSecret.length >= 32) return explicitSecret;

  const fallbackSecret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SYNC_WEBHOOK_SECRET ?? process.env.LOVABLE_API_KEY;
  if (fallbackSecret && fallbackSecret.length >= 32) {
    return createHash("sha256").update(`unit-admin-session:${fallbackSecret}`).digest("hex");
  }

  throw new Error("UNIT_ADMIN_COOKIE_SECRET is missing or too short (min 32 chars)");
}

function hasValidSessionSecret() {
  try {
    getSessionPassword();
    return true;
  } catch {
    return false;
  }
}

function sessionConfig() {
  const password = getSessionPassword();
  return {
    password,
    name: "unit_admin_session",
    maxAge: 60 * 60 * 8, // 8h
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

export const SUPER_ADMIN_DEPOT = "sequedin";

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
        isSuper: session.data.depot === SUPER_ADMIN_DEPOT,
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
  if (!hasValidSessionSecret()) return null;
  const session = await useSession<UnitAdminSession>(sessionConfig());
  if (!session.data?.depot) return null;
  return {
    depot: session.data.depot,
    login_code: session.data.login_code,
    isSuper: session.data.depot === SUPER_ADMIN_DEPOT,
  };
});

/* -------------------- Participant management (own depot) -------------------- */

export const listUnitParticipantsFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profilesQuery = supabaseAdmin
      .from("profiles")
      .select("id, prenom, num_paie, email, depot, active, created_at")
      .order("created_at", { ascending: false });
    if (!context.isSuper) profilesQuery.eq("depot", context.depot as any);

    const [{ data: profiles, error: e1 }, { data: preds, error: e2 }] = await Promise.all([
      profilesQuery,
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
    if (!prof || (!context.isSuper && prof.depot !== context.depot)) throw new Error("Participant hors de votre unité");
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
    if (!prof || (!context.isSuper && prof.depot !== context.depot)) throw new Error("Participant hors de votre unité");
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
    if (!prof || (!context.isSuper && prof.depot !== context.depot)) throw new Error("Participant hors de votre unité");
    await supabaseAdmin.from("predictions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- Matches & predictions (own depot, read-only) -------------------- */

export const listUnitMatchesFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: matches, error: e1 }, { data: teams, error: e2 }, { data: profiles, error: e3 }] =
      await Promise.all([
        supabaseAdmin
          .from("matches")
          .select(
            "id, kickoff_at, stage, group_letter, matchday, stadium, team_a_id, team_b_id, team_a_placeholder, team_b_placeholder, score_a, score_b, finished",
          )
          .order("kickoff_at", { ascending: true }),
        supabaseAdmin.from("teams").select("id, name, code"),
        supabaseAdmin.from("profiles").select("id").eq("depot", context.depot as any),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);

    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
    const depotUserIds = new Set((profiles ?? []).map((p) => p.id));

    const { data: preds, error: e4 } = await supabaseAdmin
      .from("predictions")
      .select("match_id, user_id");
    if (e4) throw new Error(e4.message);

    const countBy = new Map<string, number>();
    for (const p of preds ?? []) {
      if (!depotUserIds.has(p.user_id)) continue;
      countBy.set(p.match_id, (countBy.get(p.match_id) || 0) + 1);
    }

    return (matches ?? []).map((m) => ({
      ...m,
      team_a: m.team_a_id ? teamMap.get(m.team_a_id) ?? null : null,
      team_b: m.team_b_id ? teamMap.get(m.team_b_id) ?? null : null,
      depot_predictions_count: countBy.get(m.id) || 0,
      depot_participants_count: depotUserIds.size,
    }));
  });

export const listUnitPredictionsForMatchFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) => z.object({ matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: e1 } = await supabaseAdmin
      .from("profiles")
      .select("id, prenom, num_paie")
      .eq("depot", context.depot as any);
    if (e1) throw new Error(e1.message);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const { data: preds, error: e2 } = await supabaseAdmin
      .from("predictions")
      .select("user_id, score_a, score_b, points, exact_score, good_winner, updated_at")
      .eq("match_id", data.matchId)
      .in("user_id", ids);
    if (e2) throw new Error(e2.message);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (preds ?? [])
      .map((p) => ({
        ...p,
        prenom: profMap.get(p.user_id)?.prenom ?? "",
        num_paie: profMap.get(p.user_id)?.num_paie ?? "",
      }))
      .sort((a, b) => b.points - a.points);
  });

// Silence unused warning if tree-shaken
export const __DEPOTS = DEPOTS;

