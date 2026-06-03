import { createServerFn } from "@tanstack/react-start";

export const getParticipationStatsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    totalUsers: number;
    usersWithPredictions: number;
    participationRate: number;
    totalPredictions: number;
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Compter les utilisateurs actifs (non admins)
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, active");
    if (pErr) throw new Error(pErr.message);

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

    const activeUsers = (profiles || []).filter((p) => p.active && !adminIds.has(p.id));
    const totalUsers = activeUsers.length;
    const activeUserIds = new Set(activeUsers.map((u) => u.id));

    // Compter les pronostics
    const { data: preds, error: prErr } = await supabaseAdmin
      .from("predictions")
      .select("user_id");
    if (prErr) throw new Error(prErr.message);

    const participants = new Set<string>();
    let totalPredictions = 0;
    for (const p of preds || []) {
      if (activeUserIds.has(p.user_id)) {
        participants.add(p.user_id);
        totalPredictions++;
      }
    }

    const usersWithPredictions = participants.size;
    const participationRate =
      totalUsers > 0 ? Math.round((usersWithPredictions / totalUsers) * 100) : 0;

    return { totalUsers, usersWithPredictions, participationRate, totalPredictions };
  },
);
