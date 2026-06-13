import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { evaluateBadges, type JoinedPrediction } from "@/lib/badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/leaderboard")({ component: Leaderboard });


import { DEPOTS as DEPOT_LIST, DEPOT_LABEL, DEPOT_LOGO } from "@/lib/depots";

const DEPOTS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les dépôts" },
  ...DEPOT_LIST.map((d) => ({ value: d.value, label: d.label })),
];

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
      const [{ data: profiles }, predictions, { data: matches }, { data: winnerBoard }, { data: scorerBoard }] = await Promise.all([
        supabase.rpc("get_public_profiles"),
        fetchAllPages((from, to) =>
          supabase.from("predictions").select("user_id, match_id, score_a, score_b, points, exact_score, good_winner").range(from, to),
        ),
        supabase.from("matches").select("id, stage, finished, score_a, score_b, kickoff_at, group_letter"),
        supabase.rpc("get_winner_board"),
        supabase.rpc("get_top_scorer_board"),
      ]);
      return {
        profiles: profiles || [],
        predictions: predictions || [],
        matches: matches || [],
        winnerBoard: winnerBoard || [],
        scorerBoard: scorerBoard || [],
      };
    },
  });


  const board = useMemo(() => {
    const r = rows as any;
    if (!r || !r.profiles) return [];
    const matchById = new Map<string, any>(r.matches.map((m: any) => [m.id, m]));
    const winnerById = new Map<string, any>((r.winnerBoard || []).map((w: any) => [w.user_id, w]));
    const scorerById = new Map<string, any>((r.scorerBoard || []).map((s: any) => [s.user_id, s]));
    type Row = {
      user_id: string; name: string; depot: string; pts: number;
      exact: number; good: number; draws: number; bonus: number;
      badges: { id: string; name: string; icon: string; description: string }[];
      totalPredictions: number; joined: JoinedPrediction[];
      winnerTeam: string | null; winnerCode: string | null; winnerBonus: number;
      scorerName: string | null; scorerClub: string | null; scorerBonus: number;
    };
    const stats = new Map<string, Row>();
    for (const p of r.profiles) {
      if (p.active === false) continue;
      if (depotFilter !== "all" && p.depot !== depotFilter) continue;
      const w = winnerById.get(p.id);
      const sc = scorerById.get(p.id);
      const winnerBonus = stage === "all" ? (w?.bonus || 0) : 0;
      const scorerBonus = stage === "all" ? (sc?.bonus || 0) : 0;
      const bonus = winnerBonus + scorerBonus;
      stats.set(p.id, {
        user_id: p.id,
        name: `${p.prenom} ${p.num_paie}`.trim() || "Anonyme",
        depot: p.depot || "sequedin",
        pts: bonus, exact: 0, good: 0, draws: 0, bonus,
        badges: [], totalPredictions: 0, joined: [],
        winnerTeam: w?.final_team_name || w?.initial_team_name || null,
        winnerCode: w?.final_team_code || w?.initial_team_code || null,
        winnerBonus,
        scorerName: sc?.player_name || null,
        scorerClub: sc?.player_club || sc?.team_name || null,
        scorerBonus,
      });
    }
    for (const pred of r.predictions) {
      const m = matchById.get(pred.match_id);
      if (!m) continue;
      const s = stats.get(pred.user_id);
      if (!s) continue;
      s.totalPredictions++;
      if (!m.finished) continue;
      s.joined.push({
        p: { score_a: pred.score_a, score_b: pred.score_b, points: pred.points || 0, exact_score: !!pred.exact_score, good_winner: !!pred.good_winner },
        m: { id: m.id, kickoff_at: m.kickoff_at, stage: m.stage, finished: m.finished, score_a: m.score_a, score_b: m.score_b, group_letter: m.group_letter },
      });
      if (stage !== "all" && m.stage !== stage) continue;
      s.pts += pred.points || 0;
      const isDraw = m.score_a === m.score_b;
      if (pred.exact_score) s.exact++;
      else if (pred.good_winner && isDraw) s.draws++;
      else if (pred.good_winner) s.good++;
    }
    for (const s of stats.values()) {
      s.joined.sort((a, b) => +new Date(a.m.kickoff_at) - +new Date(b.m.kickoff_at));
      const evaluated = evaluateBadges({ joined: s.joined, totalPredictions: s.totalPredictions });
      s.badges = evaluated.filter((b) => b.unlocked).map((b) => ({ id: b.id, name: b.name, icon: b.icon, description: b.description }));
    }
    return [...stats.values()].sort((a, b) => b.pts - a.pts || (b.good + b.draws) - (a.good + a.draws) || b.exact - a.exact);
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
                    <Stat label="Score exact" value={myRank.exact} color="text-[#7B2CBF]" />
                    <Stat label="Bon vainqueur" value={myRank.good} color="text-[#00A3E0]" />
                    <Stat label="Match nul" value={myRank.draws} color="text-[#00C389]" />
                  </div>
                )}
              </div>
              {myRank && myRank.badges?.length > 0 && (
                <BadgesRow badges={myRank.badges} />
              )}
            </div>
          </motion.div>
        )}


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
                        {isAdmin && (
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
                            <img src={DEPOT_LOGO[r.depot]} alt="" className="h-4 w-4 rounded-full object-cover" />
                            <span className="text-[10px] font-semibold">{DEPOT_LABEL[r.depot] || r.depot}</span>
                          </div>
                        )}
                        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-white/15 p-2 text-center backdrop-blur-sm">
                          <MiniStat value={r.exact} label="Exact" />
                          <MiniStat value={r.good} label="Vainq." />
                          <MiniStat value={r.draws} label="Nul" />
                        </div>
                        {(r.winnerTeam || r.scorerName) && (
                          <div className="mt-2 space-y-1">
                            {r.winnerTeam && (
                              <div className="flex items-center justify-between gap-2 rounded-md bg-white/15 px-2 py-1 backdrop-blur-sm">
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">🏆 Vainqueur</span>
                                <span className="truncate text-[11px] font-semibold">
                                  {r.winnerTeam}
                                  {r.winnerBonus ? <span className="ml-1 text-[#FFD100]">+{r.winnerBonus}</span> : null}
                                </span>
                              </div>
                            )}
                            {r.scorerName && (
                              <div className="flex items-center justify-between gap-2 rounded-md bg-white/15 px-2 py-1 backdrop-blur-sm">
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">👟 Soulier d'or</span>
                                <span className="truncate text-[11px] font-semibold">
                                  {r.scorerName}
                                  {r.scorerBonus ? <span className="ml-1 text-[#FFD100]">+{r.scorerBonus}</span> : null}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {r.badges.length > 0 && <BadgesRow badges={r.badges} light />}
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
                          <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5">
                            <img src={DEPOT_LOGO[r.depot]} alt="" className="h-4 w-4 rounded-full object-cover" />
                            <span className="text-[10px] font-semibold">{DEPOT_LABEL[r.depot] || r.depot}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-[#E4002B] to-[#7B2CBF] bg-clip-text text-2xl font-black tabular-nums text-transparent">{r.pts}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">pts</div>
                      </div>
                    </div>
                    {(r.winnerTeam || r.scorerName) && (
                      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-dashed pt-2 text-[10px]">
                        <PickLine label="Vainqueur" value={r.winnerTeam} accentValue={r.winnerBonus} />
                        <PickLine label="Soulier d'or" value={r.scorerName} accentValue={r.scorerBonus} />
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-muted/40 p-1.5 text-center">
                      <MiniStat value={r.exact} label="Exact" dark />
                      <MiniStat value={r.good} label="Vainq." dark />
                      <MiniStat value={r.draws} label="Nul" dark />
                    </div>
                    {r.badges.length > 0 && <BadgesRow badges={r.badges} />}
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
                          <th className="px-3 py-3 text-left">Équipe choisie</th>
                          <th className="px-3 py-3 text-left">Soulier d'or</th>
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3 text-right">Score exact</th>
                          <th className="px-3 py-3 text-right">Bon vainqueur</th>
                          <th className="px-3 py-3 text-right">Match nul</th>
                          <th className="px-3 py-3 text-left">Badges</th>
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
                              {isAdmin && (
                                <td className="px-3 py-2.5">
                                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1">
                                    <img src={DEPOT_LOGO[r.depot]} alt="" className="h-5 w-5 rounded-full object-cover" />
                                    <span className="text-xs font-semibold">{DEPOT_LABEL[r.depot] || r.depot}</span>
                                  </div>
                                </td>
                              )}
                              <td className="px-3 py-2.5">
                                <PickCell value={r.winnerTeam} bonus={r.winnerBonus} fallback="—" />
                              </td>
                              <td className="px-3 py-2.5">
                                <PickCell value={r.scorerName} sub={r.scorerClub} bonus={r.scorerBonus} fallback="—" />
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="bg-gradient-to-r from-[#E4002B] to-[#7B2CBF] bg-clip-text text-base font-black tabular-nums text-transparent">{r.pts}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.exact}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.good}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{r.draws}</td>
                              <td className="px-3 py-2.5">
                                {r.badges.length > 0 ? <BadgesRow badges={r.badges} compact /> : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
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

function MiniStat({ value, label, dark }: { value: number; label: string; dark?: boolean }) {
  return (
    <div>
      <div className={`text-base font-black tabular-nums ${dark ? "text-foreground" : "text-white"}`}>{value}</div>
      <div className={`text-[9px] font-bold uppercase tracking-wider ${dark ? "text-muted-foreground" : "text-white/85"}`}>{label}</div>
    </div>
  );
}

function FootballMedal({ icon, size = "md" }: { icon: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12 text-2xl" : size === "sm" ? "h-7 w-7 text-base" : "h-9 w-9 text-lg";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${dim}`}
      style={{
        background:
          "radial-gradient(circle at 30% 25%, #FFF1A8 0%, #FFD24A 25%, #E8A317 55%, #8C5A0F 100%)",
        boxShadow:
          "inset 0 2px 4px rgba(255,255,255,.7), inset 0 -3px 6px rgba(120,60,0,.55), 0 4px 10px -2px rgba(0,0,0,.35), 0 0 0 2px rgba(255,255,255,.25)",
      }}
    >
      <span
        className="absolute inset-[3px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(255,255,255,.45) 0%, rgba(255,255,255,0) 55%), radial-gradient(circle at 50% 50%, #0F7A3A 0%, #064521 80%)",
          boxShadow: "inset 0 2px 3px rgba(0,0,0,.45), inset 0 -1px 2px rgba(255,255,255,.15)",
        }}
      />
      <span className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,.6)]">{icon}</span>
    </span>
  );
}

function BadgesRow({
  badges,
  light,
  compact,
}: {
  badges: { id: string; name: string; icon: string; description: string }[];
  light?: boolean;
  compact?: boolean;
}) {
  const max = compact ? 4 : 6;
  const shown = badges.slice(0, max);
  const more = badges.length - shown.length;
  return (
    <TooltipProvider delayDuration={150}>
      <div className={`mt-2 flex flex-wrap items-stretch gap-1.5 ${compact ? "" : light ? "border-t border-dashed border-white/20 pt-2" : "border-t border-dashed pt-2"}`}>
        {shown.map((b) => (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <div
                className={`flex cursor-help items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-transform hover:-translate-y-0.5 ${
                  light
                    ? "bg-white/15 backdrop-blur-sm ring-1 ring-white/20"
                    : "bg-gradient-to-br from-amber-50 to-amber-100/60 ring-1 ring-amber-300/60 dark:from-amber-950/40 dark:to-amber-900/20 dark:ring-amber-700/40"
                }`}
              >
                <FootballMedal icon={b.icon} size="sm" />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className={`truncate text-[11px] font-bold ${light ? "text-white" : "text-foreground"}`}>{b.name}</span>
                  <span className={`truncate text-[9px] ${light ? "text-white/80" : "text-muted-foreground"}`}>{b.description}</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {more > 0 && (
          <span
            className={`inline-flex items-center rounded-full px-2 text-[10px] font-bold ${
              light ? "bg-white/15 text-white/90" : "bg-muted text-muted-foreground"
            }`}
          >
            +{more}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

function PickLine({ label, value, accentValue }: { label: string; value: string | null; accentValue?: number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="truncate text-right text-[11px] font-semibold">
        {value || "—"}
        {accentValue ? <span className="ml-1 text-[#FF8A00]">+{accentValue}</span> : null}
      </span>
    </div>
  );
}

function PickCell({ value, sub, bonus, fallback }: { value: string | null; sub?: string | null; bonus?: number; fallback: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">{fallback}</span>;
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold">
        {value}
        {bonus ? <span className="ml-1 text-xs font-bold text-[#FF8A00]">+{bonus}</span> : null}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

