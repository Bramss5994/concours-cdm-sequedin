import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { evaluateBadges, type JoinedPrediction } from "@/lib/badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/leaderboard")({ component: Leaderboard });

const STAGES = [
  { value: "all", label: "Général" },
  { value: "group", label: "Phase de groupes" },
  { value: "r32", label: "16es" },
  { value: "r16", label: "8es" },
  { value: "qf", label: "Quarts" },
  { value: "sf", label: "Demis" },
  { value: "final", label: "Finale" },
];

const DEPOTS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les dépôts" },
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
  { value: "tram", label: "Tram" },
  { value: "copem", label: "COPEM" },
  { value: "support", label: "Équipe Support" },
];
const DEPOT_LABEL: Record<string, string> = {
  sequedin: "Sequedin", faidherbe: "Faidherbe", wattrelos: "Wattrelos", pc_bus: "PC Bus", tram: "Tram", copem: "COPEM", support: "Équipe Support",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

function Leaderboard() {
  const { user, isAdmin } = useAuth();
  const [stage, setStage] = useState("all");
  const [depotFilter, setDepotFilter] = useState<string>("all");

  // Récupère le dépôt de l'utilisateur connecté
  const { data: myDepot } = useQuery({
    queryKey: ["my-depot", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("depot").eq("id", user!.id).maybeSingle();
      return (data?.depot as string | undefined) ?? null;
    },
  });

  // Verrouille le filtre sur le dépôt de l'utilisateur (sauf admin)
  useEffect(() => {
    if (!isAdmin && myDepot) setDepotFilter(myDepot);
  }, [isAdmin, myDepot]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard-data"],
    queryFn: async () => {
      const [{ data: profiles }, predictions, { data: matches }, { data: bonuses }, { data: scorerBonuses }] = await Promise.all([
        supabase.rpc("get_public_profiles"),
        fetchAllPages((from, to) =>
          supabase.from("predictions").select("user_id, match_id, points, exact_score, good_winner").range(from, to),
        ),
        supabase.from("matches").select("id, stage, finished"),
        supabase.rpc("get_winner_bonuses"),
        supabase.rpc("get_top_scorer_bonuses"),
      ]);
      return {
        profiles: profiles || [],
        predictions: predictions || [],
        matches: matches || [],
        bonuses: bonuses || [],
        scorerBonuses: scorerBonuses || [],
      };
    },
  });


  const board = useMemo(() => {
    const r = rows as any;
    if (!r || !r.profiles) return [];
    const matchById = new Map<string, any>(r.matches.map((m: any) => [m.id, m]));
    const bonusById = new Map<string, number>((r.bonuses || []).map((b: any) => [b.user_id, b.bonus || 0]));
    const scorerBonusById = new Map<string, number>((r.scorerBonuses || []).map((b: any) => [b.user_id, b.bonus || 0]));
    const stats = new Map<string, { user_id: string; name: string; depot: string; pts: number; exact: number; good: number; bonus: number; groupPts: number; koPts: number; finalPts: number; }>();
    for (const p of r.profiles) {
      if (p.active === false) continue;
      if (depotFilter !== "all" && p.depot !== depotFilter) continue;
      const bonus = stage === "all" ? (bonusById.get(p.id) || 0) + (scorerBonusById.get(p.id) || 0) : 0;
      stats.set(p.id, { user_id: p.id, name: `${p.prenom} ${p.num_paie}`.trim() || "Anonyme", depot: p.depot || "sequedin", pts: bonus, exact: 0, good: 0, bonus, groupPts: 0, koPts: 0, finalPts: 0 });
    }
    for (const pred of r.predictions) {
      const m = matchById.get(pred.match_id);
      if (!m || !m.finished) continue;
      if (stage !== "all" && m.stage !== stage) continue;
      const s = stats.get(pred.user_id);
      if (!s) continue;
      const pts = pred.points || 0;
      s.pts += pts;
      if (m.stage === "group") s.groupPts += pts;
      else if (m.stage === "final") s.finalPts += pts;
      else s.koPts += pts;
      if (pred.exact_score) s.exact++;
      if (pred.good_winner) s.good++;
    }
    return [...stats.values()].sort((a, b) => b.pts - a.pts || b.good - a.good || b.exact - a.exact);
  }, [rows, stage, depotFilter]);

  const myRank = useMemo(() => {
    if (!user) return null;
    const idx = board.findIndex((r) => r.user_id === user.id);
    if (idx === -1) return null;
    return { rank: idx + 1, total: board.length, ...board[idx] };
  }, [board, user]);

  const depotScopeLabel =
    !isAdmin || depotFilter !== "all" ? `unité ${DEPOT_LABEL[depotFilter] || depotFilter}` : "toutes unités";

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-xl text-center"
        >
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Classement réservé aux participants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pour consulter le classement, vous devez d'abord vous inscrire à votre unité.
          </p>
        </motion.div>
      </div>
    );
  }

  const top3 = board.slice(0, 3);
  const rest = board.slice(3);

  return (
    <div className="relative min-h-screen">
      {/* WC 2026 gradient background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] opacity-90" />
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#FFD100] opacity-40 blur-3xl" />
        <div className="absolute -right-20 top-32 h-72 w-72 rounded-full bg-[#00C389] opacity-40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(255,255,255,0)_0%,_hsl(var(--background))_70%)]" />
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-white"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md ring-1 ring-white/30">
            <Trophy className="h-3.5 w-3.5 text-[#FFD100]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">FIFA World Cup 26</span>
          </div>
          <h1 className="mt-3 text-4xl font-black leading-none tracking-tight sm:text-5xl">
            CLASSEMENT
          </h1>
          <p className="mt-2 text-sm text-white/85">
            {isAdmin ? "Toutes les unités — mis à jour après chaque match." : `Unité ${DEPOT_LABEL[depotFilter] || depotFilter} — mis à jour après chaque match.`}
          </p>
        </motion.div>

        {isAdmin ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Dépôt</span>
            <Select value={depotFilter} onValueChange={setDepotFilter}>
              <SelectTrigger className="w-[200px] border-white/30 bg-white/15 text-white backdrop-blur-md hover:bg-white/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-4"
          >
            <Badge className="border-white/30 bg-white/15 text-white backdrop-blur-md">
              {DEPOT_LABEL[depotFilter] || depotFilter}
            </Badge>
          </motion.div>
        )}

        {/* My rank card */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-5"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl dark:bg-card/95">
              <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-[#E4002B] via-[#7B2CBF] to-[#00A3E0]" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Ma position · {depotScopeLabel}</div>
                  {myRank ? (
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="bg-gradient-to-r from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] bg-clip-text text-4xl font-black text-transparent">#{myRank.rank}</span>
                      <span className="text-sm text-muted-foreground">/ {myRank.total}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {isAdmin && depotFilter === "all" ? "Aucun pronostic comptabilisé." : "Vous n'êtes pas dans cette unité."}
                    </div>
                  )}
                </div>
                {myRank && (
                  <div className="flex items-center gap-3 text-center">
                    <Stat label="Points" value={myRank.pts} color="text-[#E4002B]" />
                    <Stat label="Exacts" value={myRank.exact} color="text-[#7B2CBF]" />
                    <Stat label="Vainqueurs" value={myRank.good} color="text-[#00A3E0]" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Stage tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Tabs value={stage} onValueChange={setStage} className="mt-5">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-white/20 p-1 backdrop-blur-md">
              {STAGES.map((s) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value}
                  className="text-xs font-semibold text-white/85 data-[state=active]:bg-white data-[state=active]:text-[#7B2CBF] data-[state=active]:shadow-lg sm:text-sm"
                >
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {isLoading ? (
          <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Chargement…</CardContent></Card>
        ) : board.length === 0 ? (
          <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Aucun participant pour le moment.</CardContent></Card>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {top3.map((r, i) => {
                  const palette = [
                    { grad: "from-[#FFD100] via-[#FF8A00] to-[#E4002B]", shadow: "shadow-[#E4002B]/40", order: "sm:order-2 sm:scale-105", icon: "🥇" },
                    { grad: "from-[#A1A6B4] via-[#6B7280] to-[#374151]", shadow: "shadow-slate-500/40", order: "sm:order-1", icon: "🥈" },
                    { grad: "from-[#E4A36B] via-[#B45309] to-[#7C2D12]", shadow: "shadow-orange-700/40", order: "sm:order-3", icon: "🥉" },
                  ][i];
                  return (
                    <motion.div
                      key={r.user_id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.1 + i * 0.08, type: "spring", stiffness: 120 }}
                      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${palette.grad} p-4 text-white shadow-xl ${palette.shadow} ${palette.order}`}
                    >
                      <div className="absolute -right-6 -top-6 text-8xl opacity-20">{palette.icon}</div>
                      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                      <div className="relative">
                        <div className="flex items-start justify-between">
                          <div className="text-3xl drop-shadow">{palette.icon}</div>
                          <div className="text-right">
                            <div className="text-3xl font-black leading-none tabular-nums drop-shadow">{r.pts}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">points</div>
                          </div>
                        </div>
                        <div className="mt-3 truncate text-base font-bold drop-shadow">{r.name}</div>
                        {isAdmin && <div className="mt-0.5 text-[11px] opacity-90">{DEPOT_LABEL[r.depot] || r.depot}</div>}
                        <div className="mt-2 flex gap-3 text-[11px] font-semibold opacity-95">
                          <span>🎯 {r.exact}</span>
                          <span>✓ {r.good}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Mobile cards */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="mt-4 space-y-2 md:hidden"
            >
              {rest.map((r, i) => {
                const isMe = user?.id === r.user_id;
                return (
                  <motion.div
                    key={r.user_id}
                    variants={fadeUp}
                    custom={Math.min(i, 10)}
                    className={`relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition-all active:scale-[0.98] ${isMe ? "border-[#7B2CBF] ring-2 ring-[#7B2CBF]/30" : "border-border hover:border-[#00A3E0]/50"}`}
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#E4002B] via-[#7B2CBF] to-[#00A3E0]" />
                    <div className="flex items-center gap-3 pl-1.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-muted to-muted/50 text-sm font-black tabular-nums">
                        {i + 4}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-bold">{r.name}</div>
                          {isMe && <Badge className="h-4 bg-[#7B2CBF] px-1.5 text-[9px] text-white">Moi</Badge>}
                        </div>
                        {isAdmin && (
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">{DEPOT_LABEL[r.depot] || r.depot}</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-[#E4002B] to-[#7B2CBF] bg-clip-text text-2xl font-black tabular-nums text-transparent">{r.pts}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">pts</div>
                      </div>
                    </div>
                    {stage === "all" && (
                      <div className="mt-2 grid grid-cols-4 gap-1 border-t border-dashed pt-2 text-center text-[10px]">
                        <Mini value={r.groupPts} label="Grp" />
                        <Mini value={r.koPts} label="Final" />
                        <Mini value={r.finalPts} label="F" />
                        <Mini value={r.bonus} label="Bns" accent />
                      </div>
                    )}
                    <div className="mt-1.5 flex justify-end gap-3 text-[11px] text-muted-foreground">
                      <span>🎯 {r.exact}</span>
                      <span>✓ {r.good}</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Desktop table */}
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="hidden md:block"
            >
              <Card className="mt-5 overflow-hidden border-2">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] text-xs font-bold uppercase tracking-wider text-white">
                        <tr>
                          <th className="px-3 py-3 text-left">#</th>
                          <th className="px-3 py-3 text-left">Participant</th>
                          {isAdmin && <th className="px-3 py-3 text-left">Unité</th>}
                          {stage === "all" && (
                            <>
                              <th className="px-3 py-3 text-right">Groupes</th>
                              <th className="px-3 py-3 text-right">Finales</th>
                              <th className="px-3 py-3 text-right">Finale</th>
                              <th className="px-3 py-3 text-right">Bonus</th>
                            </>
                          )}
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3 text-right">Exacts</th>
                          <th className="px-3 py-3 text-right">Bons</th>
                        </tr>
                      </thead>
                      <motion.tbody initial="hidden" animate="visible" variants={staggerContainer}>
                        {rest.map((r, i) => {
                          const isMe = user?.id === r.user_id;
                          return (
                            <motion.tr
                              key={r.user_id}
                              variants={fadeUp}
                              custom={Math.min(i, 15)}
                              className={`border-t transition-colors ${isMe ? "bg-[#7B2CBF]/10 hover:bg-[#7B2CBF]/15" : "hover:bg-[#00A3E0]/5"}`}
                            >
                              <td className="px-3 py-2.5 font-black tabular-nums text-muted-foreground">{i + 4}</td>
                              <td className="px-3 py-2.5 font-semibold">
                                {r.name}
                                {isMe && <Badge className="ml-2 bg-[#7B2CBF] text-[10px] text-white">Moi</Badge>}
                              </td>
                              {isAdmin && <td className="px-3 py-2.5"><Badge variant="secondary">{DEPOT_LABEL[r.depot] || r.depot}</Badge></td>}
                              {stage === "all" && (
                                <>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.groupPts}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.koPts}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{r.finalPts}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#FF8A00]">{r.bonus}</td>
                                </>
                              )}
                              <td className="px-3 py-2.5 text-right">
                                <span className="bg-gradient-to-r from-[#E4002B] to-[#7B2CBF] bg-clip-text text-base font-black tabular-nums text-transparent">{r.pts}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.exact}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.good}</td>
                            </motion.tr>
                          );
                        })}
                      </motion.tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-black tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Mini({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`font-black tabular-nums ${accent ? "text-[#FF8A00]" : ""}`}>{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
