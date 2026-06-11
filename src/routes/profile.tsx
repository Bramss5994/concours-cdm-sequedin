import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFR } from "@/lib/time";
import { FavoriteTeamPicker } from "@/components/FavoriteTeamPicker";
import { WinnerTeamPicker } from "@/components/WinnerTeamPicker";
import { TopScorerPicker } from "@/components/TopScorerPicker";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BadgesGrid } from "@/components/BadgesGrid";
import { fetchAllPages } from "@/lib/supabase-pagination";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user, loading } = useAuth();

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

  // Unité comparison: average points per user in the same unit (depot)
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
    // Join predictions with matches and keep only finished ones, sorted chronologically
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

    // Best streak (consecutive matches scoring > 0)
    let best = 0, current = 0, currentNow = 0;
    for (const x of joined) {
      if ((x.p.points || 0) > 0) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    // Current streak = trailing run
    for (let i = joined.length - 1; i >= 0; i--) {
      if ((joined[i].p.points || 0) > 0) currentNow += 1;
      else break;
    }

    // Cumulative points evolution
    let cum = 0;
    const evolution = joined.map((x, i) => {
      cum += x.p.points || 0;
      return {
        idx: i + 1,
        label: new Date(x.m.kickoff_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" }),
        points: cum,
      };
    });

    // Best & worst match (worst = biggest gap from real score among 0-pt predictions)
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
      total: data.preds.length,
      finished,
      pts,
      exact,
      good,
      exactRate,
      goodRate,
      rate,
      avg,
      bestStreak: best,
      currentStreak: currentNow,
      evolution,
      bestMatch,
      worstMatch,
    };
  }, [data]);

  const favoriteTeam = useMemo(() => {
    if (!data?.profile?.favorite_team_id) return null;
    return data.teams.find((t: any) => t.id === data.profile!.favorite_team_id) || null;
  }, [data]);

  // Add average line to evolution chart
  const evolutionWithAvg = useMemo(() => {
    if (!stats?.evolution.length || !unitStats?.avg) return stats?.evolution || [];
    // Distribute unit avg progressively (avg total / n * i)
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

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mon profil</h1>
      {data?.profile && <p className="text-muted-foreground">{data.profile.prenom} {data.profile.num_paie}{data.profile.email && !data.profile.email.endsWith(".local") ? ` · ${data.profile.email}` : ""}</p>}

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Points" value={stats.pts} />
            <Stat label="Pronostics joués" value={`${stats.finished}/${stats.total}`} />
            <Stat label="Taux de réussite" value={`${stats.rate}%`} />
            <Stat label="Moyenne / match" value={stats.avg} />
            <Stat label="Scores exacts" value={`${stats.exact} (${stats.exactRate}%)`} />
            <Stat label="Bons vainqueurs" value={`${stats.good} (${stats.goodRate}%)`} />
            <Stat label="Meilleure série" value={stats.bestStreak} />
            <Stat label="Série en cours" value={stats.currentStreak} />
          </div>

          {/* Comparaison vs unité */}
          {unitStats && unitStats.total > 1 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 text-xs uppercase text-muted-foreground">
                  <span>Comparaison vs votre unité</span>
                  {unitStats.rank && (
                    <Badge variant="secondary">
                      {unitStats.rank}<sup>{unitStats.rank === 1 ? "er" : "e"}</sup> / {unitStats.total}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold">{stats.pts}</div>
                    <div className="text-xs text-muted-foreground">Mes points</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">{unitStats.avg.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Moyenne unité</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${stats.pts >= unitStats.avg ? "text-success" : "text-destructive"}`}>
                      {stats.pts >= unitStats.avg ? "+" : ""}{(stats.pts - unitStats.avg).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Écart</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Équipe fétiche */}
          {favoriteTeam && (
            <Card className="mt-3">
              <CardContent className="flex items-center gap-3 p-4">
                <img src={`https://flagcdn.com/w80/${favoriteTeam.code}.png`} alt={favoriteTeam.name} className="h-10 w-14 rounded-sm object-cover ring-1 ring-border" />
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Équipe fétiche</div>
                  <div className="font-semibold">{favoriteTeam.name}</div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {stats.bestMatch && stats.bestMatch.pts > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground">🏆 Meilleur pronostic</div>
                  <div className="mt-1 font-semibold">{stats.bestMatch.label}</div>
                  <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Pronostic <b>{stats.bestMatch.pred}</b> · Réel <b>{stats.bestMatch.real}</b></span>
                    <Badge>{stats.bestMatch.pts} pts</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.worstMatch && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs uppercase text-muted-foreground">💩 Pire pronostic</div>
                  <div className="mt-1 font-semibold">{stats.worstMatch.label}</div>
                  <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Pronostic <b>{stats.worstMatch.pred}</b> · Réel <b>{stats.worstMatch.real}</b></span>
                    <Badge variant="outline">{stats.worstMatch.gap} d'écart</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {evolutionWithAvg.length > 0 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Évolution des points</div>
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

          <div className="mt-3">
            <BadgesGrid
              ctx={{
                joined: data!.preds
                  .map((p: any) => ({ p, m: data!.matches.find((m: any) => m.id === p.match_id) as any }))
                  .filter((x: any) => !!x.m && x.m.finished)
                  .sort((a: any, b: any) => new Date(a.m.kickoff_at).getTime() - new Date(b.m.kickoff_at).getTime()),
                totalPredictions: data!.preds.length,
              }}
            />
          </div>
        </>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <WinnerTeamPicker />
        <TopScorerPicker />
        <FavoriteTeamPicker />
      </div>

      <h2 className="mt-8 text-xl font-bold">Mes pronostics</h2>
      <div className="mt-3 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Match</th><th className="px-3 py-2 text-center">Pronostic</th><th className="px-3 py-2 text-center">Résultat</th><th className="px-3 py-2 text-right">Points</th></tr>
          </thead>
          <tbody>
            {data?.preds.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Aucun pronostic pour l'instant.</td></tr>
            )}
            {data?.preds.map((p: any) => {
              const m: any = data.matches.find((x) => x.id === p.match_id);
              if (!m) return null;
              const nameA = m.team_a?.name || m.team_a_placeholder || "?";
              const nameB = m.team_b?.name || m.team_b_placeholder || "?";
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{formatFR(m.kickoff_at)}</td>
                  <td className="px-3 py-2">{nameA} - {nameB}</td>
                  <td className="px-3 py-2 text-center font-bold">{p.score_a} - {p.score_b}</td>
                  <td className="px-3 py-2 text-center">{m.finished ? `${m.score_a} - ${m.score_b}` : <span className="text-muted-foreground">À venir</span>}</td>
                  <td className="px-3 py-2 text-right">
                    {m.finished ? <Badge variant={p.points >= 3 ? "default" : p.points > 0 ? "secondary" : "outline"}>{p.points}</Badge> : <span className="text-muted-foreground">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </CardContent></Card>
  );
}
