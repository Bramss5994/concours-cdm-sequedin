import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, CheckCircle2, MapPin, Trophy } from "lucide-react";
import { flagSrcSet } from "@/lib/flag";
import { formatFR, isLocked, lockMessage, timeUntilLock } from "@/lib/time";
import { toast } from "sonner";

export const Route = createFileRoute("/matches")({ component: MatchesPage });

type Team = { id: string; code: string; name: string; group_letter: string | null };
type Match = {
  id: string; stage: string; group_letter: string | null; matchday: number | null;
  kickoff_at: string; stadium: string | null;
  team_a_id: string | null; team_b_id: string | null;
  team_a_placeholder: string | null; team_b_placeholder: string | null;
  score_a: number | null; score_b: number | null; finished: boolean;
  team_a: Team | null; team_b: Team | null;
};
type Prediction = { match_id: string; score_a: number; score_b: number; points: number };

const STAGES: { value: string; label: string }[] = [
  { value: "group", label: "Phase de groupes" },
  { value: "r32", label: "32es" },
  { value: "r16", label: "8es" },
  { value: "qf", label: "Quarts" },
  { value: "sf", label: "Demi-finales" },
  { value: "third", label: "3e place" },
  { value: "final", label: "Finale" },
];

function MatchesPage() {
  const { user, loading } = useAuth();
  const [stage, setStage] = useState("group");

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, team_a:team_a_id(id,code,name,group_letter), team_b:team_b_id(id,code,name,group_letter)")
        .order("kickoff_at");
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("match_id, score_a, score_b, points").eq("user_id", user!.id);
      if (error) throw error;
      return data as Prediction[];
    },
  });

  const predByMatch = useMemo(() => Object.fromEntries(predictions.map((p) => [p.match_id, p])), [predictions]);

  const filtered = matches.filter((m) => m.stage === stage);

  if (loading) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Matchs & pronostics</h1>
      <p className="mt-1 text-sm text-muted-foreground">Saisis tes scores. Les pronos se ferment automatiquement 1h avant chaque match.</p>

      {!user && (
        <Card className="mt-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm">Connecte-toi pour pronostiquer.</p>
            <Button asChild size="sm"><Link to="/auth">Se connecter</Link></Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={stage} onValueChange={setStage} className="mt-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {STAGES.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {STAGES.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : s.value === "group" ? (
              <GroupedMatches matches={filtered} predByMatch={predByMatch} canPredict={!!user} />
            ) : (
              <MatchList matches={filtered} predByMatch={predByMatch} canPredict={!!user} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function GroupedMatches({ matches, predByMatch, canPredict }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean }) {
  const groups: Record<string, Match[]> = {};
  for (const m of matches) {
    const g = m.group_letter || "?";
    (groups[g] ||= []).push(m);
  }
  const letters = Object.keys(groups).sort();
  return (
    <div className="space-y-6">
      {letters.map((g) => (
        <section key={g}>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-primary" /> Groupe {g}</h2>
          <GroupTable matches={groups[g]} />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {groups[g].map((m) => (
              <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} canPredict={canPredict} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GroupTable({ matches }: { matches: Match[] }) {
  // Build standings from finished matches
  const teams = new Map<string, { code: string; name: string; pts: number; j: number; bp: number; bc: number; }>();
  for (const m of matches) {
    for (const t of [m.team_a, m.team_b]) if (t && !teams.has(t.id)) teams.set(t.id, { code: t.code, name: t.name, pts: 0, j: 0, bp: 0, bc: 0 });
    if (m.finished && m.score_a != null && m.score_b != null && m.team_a && m.team_b) {
      const a = teams.get(m.team_a.id)!, b = teams.get(m.team_b.id)!;
      a.j++; b.j++;
      a.bp += m.score_a; a.bc += m.score_b;
      b.bp += m.score_b; b.bc += m.score_a;
      if (m.score_a > m.score_b) a.pts += 3;
      else if (m.score_a < m.score_b) b.pts += 3;
      else { a.pts++; b.pts++; }
    }
  }
  const rows = [...teams.values()].sort((x, y) => y.pts - x.pts || (y.bp - y.bc) - (x.bp - x.bc) || y.bp - x.bp);
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase">
          <tr><th className="px-2 py-2 text-left">Équipe</th><th className="px-2">J</th><th className="px-2">Pts</th><th className="px-2">BP</th><th className="px-2">BC</th><th className="px-2">Diff</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t">
              <td className="px-2 py-1.5 flex items-center gap-2">
                <img src={`https://flagcdn.com/w40/${r.code}.png`} alt="" className="h-4 w-6 rounded-sm object-cover" />{r.name}
              </td>
              <td className="px-2 text-center">{r.j}</td>
              <td className="px-2 text-center font-bold">{r.pts}</td>
              <td className="px-2 text-center">{r.bp}</td>
              <td className="px-2 text-center">{r.bc}</td>
              <td className="px-2 text-center">{r.bp - r.bc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchList({ matches, predByMatch, canPredict }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {matches.map((m) => <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} canPredict={canPredict} />)}
    </div>
  );
}

function MatchCard({ match, prediction, canPredict }: { match: Match; prediction?: Prediction; canPredict: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const locked = isLocked(match.kickoff_at);
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user) return;
    const a = Number(scoreA), b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 20 || b > 20) {
      toast.error("Scores invalides (0–20)"); return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("predictions")
      .upsert({ user_id: user.id, match_id: match.id, score_a: a, score_b: b }, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Pronostic enregistré"); qc.invalidateQueries({ queryKey: ["predictions"] }); }
  }

  const nameA = match.team_a?.name || match.team_a_placeholder || "À déterminer";
  const nameB = match.team_b?.name || match.team_b_placeholder || "À déterminer";
  const codeA = match.team_a?.code;
  const codeB = match.team_b?.code;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">{formatFR(match.kickoff_at)}</span>
          {match.stadium && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{match.stadium}</span>}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 justify-end text-right">
            <span className="font-semibold truncate">{nameA}</span>
            {codeA && <img srcSet={flagSrcSet(codeA)} src={`https://flagcdn.com/w40/${codeA}.png`} alt={nameA} className="h-6 w-8 rounded-sm object-cover ring-1 ring-border" />}
          </div>
          <div className="flex items-center gap-1">
            <Input type="number" min={0} max={20} value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={!canPredict || locked || busy} className="h-9 w-12 text-center font-bold" />
            <span className="text-muted-foreground">-</span>
            <Input type="number" min={0} max={20} value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={!canPredict || locked || busy} className="h-9 w-12 text-center font-bold" />
          </div>
          <div className="flex items-center gap-2">
            {codeB && <img srcSet={flagSrcSet(codeB)} src={`https://flagcdn.com/w40/${codeB}.png`} alt={nameB} className="h-6 w-8 rounded-sm object-cover ring-1 ring-border" />}
            <span className="font-semibold truncate">{nameB}</span>
          </div>
        </div>

        {match.finished && match.score_a != null && match.score_b != null && (
          <div className="mt-3 rounded-md bg-muted px-3 py-1.5 text-center text-sm">
            <span className="text-muted-foreground">Résultat officiel : </span>
            <span className="font-bold">{match.score_a} - {match.score_b}</span>
            {prediction && (
              <Badge variant={prediction.points >= 3 ? "default" : prediction.points > 0 ? "secondary" : "outline"} className="ml-2">
                {prediction.points} pt{prediction.points > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {locked ? (
            <span className="flex items-center gap-1 text-xs text-destructive"><Lock className="h-3 w-3" />{match.finished ? "Match terminé" : lockMessage(match.kickoff_at)}</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" />{timeUntilLock(match.kickoff_at)}</span>
          )}
          {canPredict && !locked && (
            <Button size="sm" onClick={save} disabled={busy}>{prediction ? "Modifier" : "Pronostiquer"}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
