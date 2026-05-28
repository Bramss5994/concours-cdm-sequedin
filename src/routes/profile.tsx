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
    const finishedPreds = data.preds.filter((p) => data.matches.find((m) => m.id === p.match_id && m.finished));
    const exact = finishedPreds.filter((p) => p.exact_score).length;
    const good = finishedPreds.filter((p) => p.good_winner).length;
    const pts = finishedPreds.reduce((s, p) => s + (p.points || 0), 0);
    return { total: data.preds.length, finished: finishedPreds.length, pts, exact, good, rate: finishedPreds.length ? Math.round(((exact + good) / finishedPreds.length) * 100) : 0 };
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Points" value={stats.pts} />
          <Stat label="Scores exacts" value={stats.exact} />
          <Stat label="Bons vainqueurs" value={stats.good} />
          <Stat label="Taux de réussite" value={`${stats.rate}%`} />
        </div>
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
