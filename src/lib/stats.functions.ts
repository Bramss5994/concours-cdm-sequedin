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
    matchesPlayed: number;
    matchesTotal: number;
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

    // Compter les pronostics (paginé, Supabase limite à 1000 par requête)
    const preds: { user_id: string }[] = [];
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from("predictions")
          .select("user_id")
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        const batch = data ?? [];
        preds.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
    }

    const participants = new Set<string>();
    let totalPredictions = 0;
    for (const p of preds) {
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

    // Matchs joués / total
    const { count: matchesTotal } = await supabaseAdmin
      .from("matches")
      .select("*", { count: "exact", head: true });
    const { count: matchesPlayed } = await supabaseAdmin
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("finished", true);

    return {
      totalUsers,
      usersWithPredictions,
      participationRate,
      totalPredictions,
      byDepot,
      matchesPlayed: matchesPlayed ?? 0,
      matchesTotal: matchesTotal ?? 0,
    };
  },
);

export const getNextMatchFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    id: string;
    kickoffAt: string;
    stage: string;
    groupLetter: string | null;
    stadium: string | null;
    teamA: { name: string; code: string | null } | null;
    teamB: { name: string; code: string | null } | null;
    teamAPlaceholder: string | null;
    teamBPlaceholder: string | null;
  } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("matches")
      .select(
        "id, kickoff_at, stage, group_letter, stadium, team_a_placeholder, team_b_placeholder, team_a:teams!matches_team_a_id_fkey(name,code), team_b:teams!matches_team_b_id_fkey(name,code)",
      )
      .gt("kickoff_at", nowIso)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      kickoffAt: data.kickoff_at,
      stage: data.stage,
      groupLetter: data.group_letter,
      stadium: data.stadium,
      teamA: (data as any).team_a ?? null,
      teamB: (data as any).team_b ?? null,
      teamAPlaceholder: data.team_a_placeholder,
      teamBPlaceholder: data.team_b_placeholder,
    };
  },
);
