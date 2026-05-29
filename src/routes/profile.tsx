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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user, loading } = useAuth();

  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: preds }, { data: matches }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("predictions").select("*").eq("user_id", user!.id),
        supabase.from("matches").select("id, kickoff_at, stage, finished, score_a, score_b, team_a:teams!matches_team_a_id_fkey(code,name), team_b:teams!matches_team_b_id_fkey(code,name), team_a_placeholder, team_b_placeholder").order("kickoff_at"),
      ]);
      return { profile, preds: preds || [], matches: matches || [] };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    // Join predictions with matches and keep only finished ones, sorted chronologically
    const joined = data.preds
      .map((p: any) => ({ p, m: data.matches.find((m: any) => m.id === p.match_id) }))
      .filter((x) => x.m && x.m.finished)
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
        label: new Date(x.m.kickoff_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        points: cum,
      };
    });

    // Best match
    const bestMatch = joined.reduce<{ pts: number; label: string } | null>((acc, x) => {
      const pp = x.p.points || 0;
      if (!acc || pp > acc.pts) {
        const nameA = x.m.team_a?.name || x.m.team_a_placeholder || "?";
        const nameB = x.m.team_b?.name || x.m.team_b_placeholder || "?";
        return { pts: pp, label: `${nameA} - ${nameB}` };
      }
      return acc;
    }, null);

    return {
      total: data.preds.length,
      finished,
      pts,
      exact,
      good,
      rate,
      avg,
      bestStreak: best,
      currentStreak: currentNow,
      evolution,
      bestMatch,
    };
  }, [data]);

  if (loading) return null;
  if (!user) return (
    <div className="container mx-auto max-w-md px-4 py-10 text-center">
      <p>Tu dois être connecté pour voir ton profil.</p>
      <Button asChild className="mt-4"><Link to="/auth">Se connecter</Link></Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mon profil</h1>
      {data?.profile && <p className="text-muted-foreground">{data.profile.prenom} {data.profile.num_paie} · {data.profile.email}</p>}

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Points" value={stats.pts} />
            <Stat label="Pronostics joués" value={`${stats.finished}/${stats.total}`} />
            <Stat label="Taux de réussite" value={`${stats.rate}%`} />
            <Stat label="Moyenne / match" value={stats.avg} />
            <Stat label="Scores exacts" value={stats.exact} />
            <Stat label="Bons vainqueurs" value={stats.good} />
            <Stat label="Meilleure série" value={stats.bestStreak} />
            <Stat label="Série en cours" value={stats.currentStreak} />
          </div>

          {stats.bestMatch && stats.bestMatch.pts > 0 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Meilleur pronostic</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="font-semibold">{stats.bestMatch.label}</div>
                  <Badge>{stats.bestMatch.pts} pts</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {stats.evolution.length > 0 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Évolution des points</div>
                <ChartContainer
                  className="mt-2 h-48 w-full"
                  config={{ points: { label: "Points cumulés", color: "hsl(var(--primary))" } }}
                >
                  <AreaChart data={stats.evolution} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
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
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="mt-6">
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
