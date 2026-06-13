import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Button3D } from "@/components/Button3D";
import { formatFR } from "@/lib/time";
import { FavoriteTeamPicker } from "@/components/FavoriteTeamPicker";
import { WinnerTeamPicker } from "@/components/WinnerTeamPicker";
import { TopScorerPicker } from "@/components/TopScorerPicker";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BadgesGrid } from "@/components/BadgesGrid";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { DEPOT_LABEL, DEPOT_LOGO } from "@/lib/depots";
import { Trophy, Target, Flame, Zap, TrendingUp, Star, Sparkles, ListChecks } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"wins" | "all">("wins");

  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: preds }, { data: matches }, { data: teams }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("predictions").select("*").eq("user_id", user!.id),
        supabase.from("matches").select("id, kickoff_at, stage, group_letter, finished, score_a, score_b, team_a:teams!matches_team_a_id_fkey(code,name), team_b:teams!matches_team_b_id_fkey(code,name), team_a_placeholder, team_b_placeholder").order("kickoff_at"),
        supabase.from("teams").select("id, code, name"),
      ]);
      return { profile, preds: preds || [], matches: matches || [], teams: teams || [] };
    },
  });

  const { data: unitStats } = useQuery({
    queryKey: ["unit-stats", data?.profile?.depot],
    enabled: !!data?.profile?.depot,
    queryFn: async () => {
      const { data: profiles } = await supabase.rpc("get_public_profiles");
      const sameUnit = (profiles || []).filter((p: any) => p.depot === data!.profile!.depot && p.active);
      const ids = sameUnit.map((p: any) => p.id);
      if (!ids.length) return { avg: 0, rank: null as number | null, total: 0 };
      const preds = await fetchAllPages<{ user_id: string; points: number | null }>((from, to) =>
        supabase.from("predictions").select("user_id, points").in("user_id", ids).range(from, to),
      );
      const totals = new Map<string, number>();
      for (const id of ids) totals.set(id, 0);
      for (const p of preds || []) totals.set(p.user_id, (totals.get(p.user_id) || 0) + (p.points || 0));
      const values = [...totals.values()];
      const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      const myPts = totals.get(user!.id) || 0;
      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const rank = sorted.findIndex(([id]) => id === user!.id) + 1 || null;
      return { avg, myPts, rank, total: ids.length };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const joined = data.preds
      .map((p: any) => ({ p, m: data.matches.find((m: any) => m.id === p.match_id) as any }))
      .filter((x): x is { p: any; m: any } => !!x.m && x.m.finished)
      .sort((a, b) => new Date(a.m.kickoff_at).getTime() - new Date(b.m.kickoff_at).getTime());

    const finished = joined.length;
    const exact = joined.filter((x) => x.p.exact_score).length;
    const good = joined.filter((x) => x.p.good_winner).length;
    const pts = joined.reduce((s, x) => s + (x.p.points || 0), 0);
    const successCount = joined.filter((x) => (x.p.points || 0) > 0).length;
    const rate = finished ? Math.round((successCount / finished) * 100) : 0;
    const avg = finished ? (pts / finished).toFixed(2) : "0";

    let best = 0, current = 0, currentNow = 0;
    for (const x of joined) {
      if ((x.p.points || 0) > 0) { current += 1; if (current > best) best = current; }
      else current = 0;
    }
    for (let i = joined.length - 1; i >= 0; i--) {
      if ((joined[i].p.points || 0) > 0) currentNow += 1; else break;
    }

    let cum = 0;
    const evolution = joined.map((x, i) => {
      cum += x.p.points || 0;
      return {
        idx: i + 1,
        label: new Date(x.m.kickoff_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" }),
        points: cum,
      };
    });

    let bestMatch: { pts: number; label: string; pred: string; real: string } | null = null;
    let worstMatch: { gap: number; label: string; pred: string; real: string } | null = null;
    for (const x of joined) {
      const pp = x.p.points || 0;
      const nameA = x.m.team_a?.name || x.m.team_a_placeholder || "?";
      const nameB = x.m.team_b?.name || x.m.team_b_placeholder || "?";
      const pred = `${x.p.score_a}-${x.p.score_b}`;
      const real = `${x.m.score_a}-${x.m.score_b}`;
      const label = `${nameA} - ${nameB}`;
      if (!bestMatch || pp > bestMatch.pts) bestMatch = { pts: pp, label, pred, real };
      if (pp === 0) {
        const gap = Math.abs((x.p.score_a - x.m.score_a)) + Math.abs((x.p.score_b - x.m.score_b));
        if (!worstMatch || gap > worstMatch.gap) worstMatch = { gap, label, pred, real };
      }
    }

    const exactRate = finished ? Math.round((exact / finished) * 100) : 0;
    const goodRate = finished ? Math.round((good / finished) * 100) : 0;

    return {
      total: data.preds.length, finished, pts, exact, good, exactRate, goodRate,
      rate, avg, bestStreak: best, currentStreak: currentNow, evolution, bestMatch, worstMatch,
      joined,
    };
  }, [data]);

  const favoriteTeam = useMemo(() => {
    if (!data?.profile?.favorite_team_id) return null;
    return data.teams.find((t: any) => t.id === data.profile!.favorite_team_id) || null;
  }, [data]);

  const evolutionWithAvg = useMemo(() => {
    if (!stats?.evolution.length || !unitStats?.avg) return stats?.evolution || [];
    const n = stats.evolution.length;
    return stats.evolution.map((e, i) => ({ ...e, average: Math.round((unitStats.avg * (i + 1)) / n) }));
  }, [stats, unitStats]);

  if (loading) return null;
  if (!user) return (
    <div className="container mx-auto max-w-md px-4 py-10 text-center">
      <p>Vous devez être connecté·e pour voir votre profil.</p>
      <Button asChild className="mt-4"><Link to="/auth">Se connecter</Link></Button>
    </div>
  );

  const initials = (data?.profile?.prenom?.[0] || "?").toUpperCase();
  const depot = data?.profile?.depot;
  const winningMatches = (stats?.joined || []).filter((x) => (x.p.points || 0) > 0)
    .sort((a, b) => (b.p.points || 0) - (a.p.points || 0));
  const allMatches = [...(data?.preds || [])]
    .map((p: any) => ({ p, m: data!.matches.find((m: any) => m.id === p.match_id) as any }))
    .filter((x) => x.m)
    .sort((a, b) => new Date(b.m.kickoff_at).getTime() - new Date(a.m.kickoff_at).getTime());

  return (
    <div className="relative min-h-screen">
      {/* WC 2026 hero background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] opacity-90" />
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#FFD100] opacity-40 blur-3xl" />
        <div className="absolute -right-20 top-32 h-72 w-72 rounded-full bg-[#00C389] opacity-40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(255,255,255,0)_0%,_hsl(var(--background))_70%)]" />
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4 text-white"
        >
          <div className="relative">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[#FFD100] to-[#FF8A00] text-3xl font-black text-[#3a1f00] shadow-xl ring-2 ring-white/40">
              {initials}
            </div>
            {depot && DEPOT_LOGO[depot] && (
              <img
                src={DEPOT_LOGO[depot]}
                alt=""
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full object-cover ring-2 ring-white shadow"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-md ring-1 ring-white/30">
              <Sparkles className="h-3 w-3 text-[#FFD100]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Mon profil</span>
            </div>
            <h1 className="mt-1 truncate text-2xl font-black sm:text-4xl">
              {data?.profile?.prenom || "Pronostiqueur"} {data?.profile?.num_paie}
            </h1>
            {depot && (
              <p className="text-xs text-white/80">Unité {DEPOT_LABEL[depot] || depot}</p>
            )}
          </div>
        </motion.div>

        {stats && (
          <>
            {/* Big numbers row */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <BigStat icon={<Trophy className="h-5 w-5" />} value={stats.pts} label="Points" gradient="from-[#FFD100] via-[#FF8A00] to-[#E4002B]" />
              <BigStat icon={<Target className="h-5 w-5" />} value={`${stats.rate}%`} label="Réussite" gradient="from-[#00C389] via-[#00A3E0] to-[#7B2CBF]" />
              <BigStat icon={<Flame className="h-5 w-5" />} value={stats.currentStreak} label="Série en cours" gradient="from-[#FF4D5E] via-[#E4002B] to-[#7B2CBF]" />
              <BigStat icon={<Zap className="h-5 w-5" />} value={stats.bestStreak} label="Meilleure série" gradient="from-[#7B2CBF] via-[#00A3E0] to-[#00C389]" />
            </motion.div>

            {/* Detail stats */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <MiniStat label="Pronos joués" value={`${stats.finished}/${stats.total}`} accent="text-[#7B2CBF]" />
              <MiniStat label="Moyenne / match" value={stats.avg} accent="text-[#00A3E0]" />
              <MiniStat label="Scores exacts" value={`${stats.exact} (${stats.exactRate}%)`} accent="text-[#FFD100]" />
              <MiniStat label="Bons vainqueurs" value={`${stats.good} (${stats.goodRate}%)`} accent="text-[#00C389]" />
            </motion.div>

            {/* Comparison vs unit */}
            {unitStats && unitStats.total > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="mt-3 overflow-hidden border-2">
                  <div className="bg-gradient-to-r from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] px-4 py-2 text-white">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Comparaison vs votre unité</span>
                      {unitStats.rank && (
                        <span className="rounded-full bg-white/25 px-2 py-0.5 backdrop-blur-md">
                          {unitStats.rank}<sup>{unitStats.rank === 1 ? "er" : "e"}</sup> / {unitStats.total}
                        </span>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="bg-gradient-to-r from-[#E4002B] to-[#7B2CBF] bg-clip-text text-3xl font-black text-transparent">{stats.pts}</div>
                        <div className="text-xs text-muted-foreground">Mes points</div>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-muted-foreground">{unitStats.avg.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Moyenne unité</div>
                      </div>
                      <div>
                        <div className={`text-3xl font-black ${stats.pts >= unitStats.avg ? "text-[#00C389]" : "text-[#E4002B]"}`}>
                          {stats.pts >= unitStats.avg ? "+" : ""}{(stats.pts - unitStats.avg).toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">Écart</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Best / Worst */}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {stats.bestMatch && stats.bestMatch.pts > 0 && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFD100] via-[#FF8A00] to-[#E4002B] p-4 text-white shadow-xl">
                    <div className="absolute -right-4 -top-4 text-7xl opacity-20">🏆</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Meilleur pronostic</div>
                    <div className="mt-1 text-base font-black drop-shadow">{stats.bestMatch.label}</div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="opacity-90">Prono <b>{stats.bestMatch.pred}</b> · Réel <b>{stats.bestMatch.real}</b></span>
                      <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-sm font-black backdrop-blur-md">{stats.bestMatch.pts} pts</span>
                    </div>
                  </div>
                </motion.div>
              )}
              {stats.worstMatch && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-4 text-white shadow-xl">
                    <div className="absolute -right-4 -top-4 text-7xl opacity-20">💩</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Pire pronostic</div>
                    <div className="mt-1 text-base font-black">{stats.worstMatch.label}</div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="opacity-80">Prono <b>{stats.worstMatch.pred}</b> · Réel <b>{stats.worstMatch.real}</b></span>
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-black">{stats.worstMatch.gap} d'écart</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Favorite team */}
            {favoriteTeam && (
              <Card className="mt-3">
                <CardContent className="flex items-center gap-3 p-4">
                  <img src={`https://flagcdn.com/w80/${favoriteTeam.code}.png`} alt={favoriteTeam.name} className="h-10 w-14 rounded-sm object-cover ring-1 ring-border" />
                  <div className="flex-1">
                    <div className="text-xs uppercase text-muted-foreground">Équipe fétiche</div>
                    <div className="font-semibold">{favoriteTeam.name}</div>
                  </div>
                  <Star className="h-5 w-5 text-[#FFD100]" />
                </CardContent>
              </Card>
            )}

            {/* Evolution chart */}
            {evolutionWithAvg.length > 0 && (
              <Card className="mt-3">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <TrendingUp className="h-4 w-4" /> Évolution des points
                  </div>
                  <ChartContainer
                    className="mt-2 h-48 w-full"
                    config={{
                      points: { label: "Mes points", color: "hsl(var(--primary))" },
                      average: { label: "Moyenne unité", color: "hsl(var(--muted-foreground))" },
                    }}
                  >
                    <AreaChart data={evolutionWithAvg} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-points)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-points)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} width={28} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="points" stroke="var(--color-points)" strokeWidth={2} fill="url(#pointsFill)" />
                      {unitStats && unitStats.avg > 0 && (
                        <Area type="monotone" dataKey="average" stroke="var(--color-average)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                      )}
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Badges */}
            <div className="mt-3">
              <BadgesGrid
                ctx={{
                  joined: stats.joined,
                  totalPredictions: data!.preds.length,
                }}
              />
            </div>
          </>
        )}

        {/* Pickers */}
        <h2 className="mt-8 flex items-center gap-2 text-xl font-black">
          <Sparkles className="h-5 w-5 text-[#FFD100]" /> Mes choix CDM
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <WinnerTeamPicker />
          <TopScorerPicker />
          <FavoriteTeamPicker />
        </div>

        {/* Predictions section with tabs */}
        <h2 className="mt-8 flex items-center gap-2 text-xl font-black">
          <ListChecks className="h-5 w-5 text-[#7B2CBF]" /> Mes pronostics
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button3D
            variant={tab === "wins" ? "gold" : "dark"}
            onClick={() => setTab("wins")}
            leftIcon={<Trophy className="h-4 w-4" />}
          >
            Matchs gagnés
            <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{winningMatches.length}</span>
          </Button3D>
          <Button3D
            variant={tab === "all" ? "primary" : "dark"}
            onClick={() => setTab("all")}
            leftIcon={<ListChecks className="h-4 w-4" />}
          >
            Tous mes pronostics
            <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{allMatches.length}</span>
          </Button3D>
        </div>

        <AnimatePresence mode="wait">
          {tab === "wins" ? (
            <motion.div
              key="wins"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4"
            >
              {winningMatches.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Aucun match gagné pour le moment. Vos points apparaîtront ici !
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {winningMatches.map(({ p, m }) => {
                    const nameA = m.team_a?.name || m.team_a_placeholder || "?";
                    const nameB = m.team_b?.name || m.team_b_placeholder || "?";
                    const pts = p.points || 0;
                    const isExact = !!p.exact_score;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -2 }}
                        className="relative overflow-hidden rounded-2xl border-2 border-[#FFD100]/40 bg-gradient-to-br from-[#FFF8E0] via-white to-[#FFEBA8] p-4 shadow-md dark:from-amber-950/30 dark:via-card dark:to-amber-900/20"
                      >
                        <div className="absolute -right-4 -top-4 text-6xl opacity-15">
                          {isExact ? "🎯" : "🏆"}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {formatFR(m.kickoff_at)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              {m.team_a?.code && <img src={`https://flagcdn.com/w40/${m.team_a.code}.png`} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}
                              <span className="truncate text-sm font-bold">{nameA}</span>
                              <span className="text-xs text-muted-foreground">vs</span>
                              <span className="truncate text-sm font-bold">{nameB}</span>
                              {m.team_b?.code && <img src={`https://flagcdn.com/w40/${m.team_b.code}.png`} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}
                            </div>
                          </div>
                          <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#FFE066] to-[#E6A800] text-xl font-black text-[#3a1f00] shadow-[inset_0_2px_0_rgba(255,255,255,.5),0_3px_0_#8c5a0f]">
                            +{pts}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-xs backdrop-blur-sm dark:bg-black/30">
                          <span>Pronostic <b className="text-[#7B2CBF]">{p.score_a}-{p.score_b}</b></span>
                          <span>Résultat <b className="text-[#00C389]">{m.score_a}-{m.score_b}</b></span>
                          {isExact && (
                            <span className="rounded-full bg-[#E4002B] px-2 py-0.5 text-[9px] font-bold uppercase text-white">Exact</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="all"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4 overflow-x-auto rounded-xl border-2 bg-card shadow-sm"
            >
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] text-xs font-bold uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Match</th>
                    <th className="px-3 py-2 text-center">Pronostic</th>
                    <th className="px-3 py-2 text-center">Résultat</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {allMatches.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Aucun pronostic pour l'instant.</td></tr>
                  )}
                  {allMatches.map(({ p, m }) => {
                    const nameA = m.team_a?.name || m.team_a_placeholder || "?";
                    const nameB = m.team_b?.name || m.team_b_placeholder || "?";
                    const won = m.finished && (p.points || 0) > 0;
                    return (
                      <tr key={p.id} className={`border-t transition-colors ${won ? "bg-[#FFD100]/10 hover:bg-[#FFD100]/20" : "hover:bg-muted/40"}`}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatFR(m.kickoff_at)}</td>
                        <td className="px-3 py-2">{nameA} - {nameB}</td>
                        <td className="px-3 py-2 text-center font-bold">{p.score_a} - {p.score_b}</td>
                        <td className="px-3 py-2 text-center">{m.finished ? `${m.score_a} - ${m.score_b}` : <span className="text-muted-foreground">À venir</span>}</td>
                        <td className="px-3 py-2 text-right">
                          {m.finished ? (
                            <Badge className={
                              p.points >= 3 ? "bg-[#FFD100] text-[#3a1f00] hover:bg-[#FFD100]"
                              : p.points > 0 ? "bg-[#00C389] text-white hover:bg-[#00C389]"
                              : "bg-muted text-muted-foreground hover:bg-muted"
                            }>{p.points}</Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BigStat({ icon, value, label, gradient }: { icon: React.ReactNode; value: number | string; label: string; gradient: string }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-xl`}
    >
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 backdrop-blur-md">
            {icon}
          </div>
          <div className="text-3xl font-black tabular-nums drop-shadow">{value}</div>
        </div>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider opacity-90">{label}</div>
      </div>
    </motion.div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <Card className="border-2">
      <CardContent className="p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-black tabular-nums ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
