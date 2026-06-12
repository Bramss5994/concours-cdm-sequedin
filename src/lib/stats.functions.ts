import { createServerFn } from "@tanstack/react-start";

const DEPOT_LABELS: Record<string, string> = {
  sequedin: "Sequedin",
  faidherbe: "Faidherbe",
  wattrelos: "Wattrelos",
  pc_bus: "PC Bus",
  tram: "Tram",
  copem: "COPEM",
  support: "Équipe Support",
};

export const getParticipationStatsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    totalUsers: number;
    usersWithPredictions: number;
    participationRate: number;
    totalPredictions: number;
    byDepot: { depot: string; label: string; count: number }[];
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Compter les utilisateurs actifs (non admins)
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, active, depot");
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

    // Compter par dépôt
    const depotCounts = new Map<string, number>();
    for (const u of activeUsers) {
      const d = (u as any).depot ?? "—";
      depotCounts.set(d, (depotCounts.get(d) ?? 0) + 1);
    }
    const byDepot = Object.keys(DEPOT_LABELS).map((d) => ({
      depot: d,
      label: DEPOT_LABELS[d],
      count: depotCounts.get(d) ?? 0,
    }));

    return { totalUsers, usersWithPredictions, participationRate, totalPredictions, byDepot };
  },
);
