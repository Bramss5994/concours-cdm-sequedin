import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireUnitAdmin, SUPER_ADMIN_DEPOT } from "@/lib/unit-admin.functions";

function assertSuper(ctx: { isSuper: boolean }) {
  if (!ctx.isSuper) throw new Error("Forbidden: super admin required");
}

/* ---------- Super admin management ---------- */

export const listAnnouncementsAsSuperFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("announcements")
      .select("id, title, body, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; title: string; body: string; active: boolean; created_at: string;
    }>;
  });

export const createAnnouncementAsSuperFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(4000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("announcements")
      .insert({ title: data.title, body: data.body, active: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const toggleAnnouncementAsSuperFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("announcements")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAnnouncementAsSuperFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("announcements")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnnouncementReadStatsAsSuperFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await (supabaseAdmin as any)
      .from("announcement_reads")
      .select("user_id", { count: "exact", head: true })
      .eq("announcement_id", data.id);
    if (error) throw new Error(error.message);
    return { reads: count ?? 0 };
  });

/* ---------- End-user (authenticated) ---------- */

export const getUnreadAnnouncementsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: active, error: e1 } = await (supabase as any)
      .from("announcements")
      .select("id, title, body, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (e1) throw new Error(e1.message);
    const list = (active ?? []) as Array<{ id: string; title: string; body: string; created_at: string }>;
    if (list.length === 0) return [];
    const { data: reads, error: e2 } = await (supabase as any)
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId)
      .in("announcement_id", list.map((a) => a.id));
    if (e2) throw new Error(e2.message);
    const readSet = new Set((reads ?? []).map((r: any) => r.announcement_id as string));
    return list.filter((a) => !readSet.has(a.id));
  });

export const markAnnouncementReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await (supabase as any)
      .from("announcement_reads")
      .upsert({ announcement_id: data.id, user_id: userId }, { onConflict: "announcement_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// keep SUPER_ADMIN_DEPOT reachable to prevent tree-shake surprises in some builds
export const _superDepot = SUPER_ADMIN_DEPOT;
