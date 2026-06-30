import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isLocked, formatFR, timeUntilLock } from "@/lib/time";
import { toast } from "sonner";
import { Trophy, Lock, Radio, CalendarClock, ListChecks, Table2, Goal, Network, Pencil } from "lucide-react";
import { flagUrl, flagSrcSet } from "@/lib/flag";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { BracketView } from "@/components/BracketView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { isSequedinSuperAdminFn } from "@/lib/super-admin.functions";
import { updateBracketMatchAsSuperFn } from "@/lib/bracket-sync.functions";



export const Route = createFileRoute("/matches")({ component: MatchesPage });

type Match = {
  id: string;
  kickoff_at: string;
  stadium: string | null;
  stage?: string | null;
  group_letter?: string | null;
  matchday?: number | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a: { name: string; code?: string } | null;
  team_b: { name: string; code?: string } | null;
  team_a_placeholder?: string | null;
  team_b_placeholder?: string | null;
  finished: boolean;
  score_a: number | null;
  score_b: number | null;
  score_a_et?: number | null;
  score_b_et?: number | null;
  score_a_pen?: number | null;
  score_b_pen?: number | null;
  live_status?: string | null;
  live_score_a?: number | null;
  live_score_b?: number | null;
  live_elapsed?: number | null;
};

type Prediction = { match_id: string; score_a: number; score_b: number; points?: number | null };

function teamName(m: Match, side: "a" | "b"): string {
  const t = side === "a" ? m.team_a : m.team_b;
  if (t?.name) return t.name;
  return (side === "a" ? m.team_a_placeholder : m.team_b_placeholder) || "À déterminer";
}

function ExtraTimeBadge({ m }: { m: Match }) {
  const s = (m.live_status || "").toUpperCase();
  const hasPen =
    s === "PEN" ||
    (m.score_a_pen != null && m.score_b_pen != null);
  const hasEt =
    s === "AET" ||
    (m.score_a_et != null && m.score_b_et != null);
  if (hasPen) {
    return (
      <Badge variant="outline" className="ml-2 border-amber-500/60 text-amber-700 bg-amber-50">
        t.a.b.
        {m.score_a_pen != null && m.score_b_pen != null ? ` ${m.score_a_pen}-${m.score_b_pen}` : ""}
      </Badge>
    );
  }
  if (hasEt) {
    return (
      <Badge variant="outline" className="ml-2 border-blue-500/60 text-blue-700 bg-blue-50">
        a.p.
      </Badge>
    );
  }
  return null;
}

function FinalScore({ m }: { m: Match }) {
  if (m.score_a == null || m.score_b == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="font-mono font-bold tabular-nums">
      {m.score_a} - {m.score_b}
    </span>
  );
}

function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScoreA(prediction ? String(prediction.score_a) : "");
    setScoreB(prediction ? String(prediction.score_b) : "");
  }, [prediction?.score_a, prediction?.score_b]);

  const locked = isLocked(match.kickoff_at);

  async function save() {
    if (!user) {
      toast.error("Connectez-vous pour enregistrer un pronostic.");
      return;
    }
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (scoreA === "" || scoreB === "" || Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      toast.error("Veuillez saisir les deux scores.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("predictions")
        .upsert(
          { user_id: user.id, match_id: match.id, score_a: a, score_b: b },
          { onConflict: "user_id,match_id" },
        );
      if (error) {
        console.error("Prediction save error:", error);
        toast.error(`Erreur: ${error.message}`);
      } else {
        toast.success("Pronostic enregistré");
        qc.invalidateQueries({ queryKey: ["predictions"] });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur réseau lors de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 p-4">
      <div className="flex justify-between text-xs text-muted-foreground mb-3">
        <span>{formatFR(match.kickoff_at)}</span>
        <span className="truncate ml-2">{match.stadium}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <div className="flex flex-col items-center gap-1 text-center">
          {match.team_a?.code ? (
            <img src={flagUrl(match.team_a.code, 40)} srcSet={flagSrcSet(match.team_a.code)} alt="" className="h-8 w-12 rounded-sm object-cover" />
          ) : (
            <span className="text-2xl">🏳️</span>
          )}
          <span className="font-bold text-sm leading-tight">{teamName(match, "a")}</span>
        </div>
        <div className="text-xs text-muted-foreground font-semibold">VS</div>
        <div className="flex flex-col items-center gap-1 text-center">
          {match.team_b?.code ? (
            <img src={flagUrl(match.team_b.code, 40)} srcSet={flagSrcSet(match.team_b.code)} alt="" className="h-8 w-12 rounded-sm object-cover" />
          ) : (
            <span className="text-2xl">🏳️</span>
          )}
          <span className="font-bold text-sm leading-tight">{teamName(match, "b")}</span>
        </div>
      </div>

      {locked ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2 border-t">
          <Lock className="h-4 w-4" />
          Pronostics fermés
          {prediction && (
            <span className="ml-2 font-mono">
              (vous: {prediction.score_a}-{prediction.score_b})
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-3">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              disabled={busy}
              className="w-14 p-2 border rounded-lg text-center font-bold text-lg bg-background"
              aria-label={`Score ${teamName(match, "a")}`}
            />
            <span className="font-bold">-</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              disabled={busy}
              className="w-14 p-2 border rounded-lg text-center font-bold text-lg bg-background"
              aria-label={`Score ${teamName(match, "b")}`}
            />
            <Button onClick={save} disabled={busy} className="ml-2">
              {prediction ? "Modifier" : "Valider"}
            </Button>
          </div>
          <div className="text-center text-[11px] text-muted-foreground mt-2">
            {timeUntilLock(match.kickoff_at)}
          </div>
        </>
      )}
    </Card>
  );
}

function ResultRow({ m }: { m: Match }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground w-28 hidden sm:block">{formatFR(m.kickoff_at)}</div>
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
        <span className="truncate font-medium text-right">{teamName(m, "a")}</span>
        {m.team_a?.code && <img src={flagUrl(m.team_a.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
      </div>
      <div className="px-2 flex items-center">
        <FinalScore m={m} />
        <ExtraTimeBadge m={m} />
      </div>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {m.team_b?.code && <img src={flagUrl(m.team_b.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
        <span className="truncate font-medium">{teamName(m, "b")}</span>
      </div>
    </div>
  );
}

function LiveRow({ m }: { m: Match }) {
  const a = m.live_score_a ?? m.score_a;
  const b = m.live_score_b ?? m.score_b;
  return (
    <div className="flex items-center gap-3 rounded-lg border-2 border-red-400 bg-red-50/40 p-3">
      <Badge className="bg-red-600 text-white animate-pulse"><Radio className="h-3 w-3 mr-1" />LIVE</Badge>
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
        <span className="truncate font-medium text-right">{teamName(m, "a")}</span>
        {m.team_a?.code && <img src={flagUrl(m.team_a.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
      </div>
      <div className="font-mono font-bold tabular-nums">{a ?? 0}-{b ?? 0}</div>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {m.team_b?.code && <img src={flagUrl(m.team_b.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
        <span className="truncate font-medium">{teamName(m, "b")}</span>
      </div>
      <div className="text-xs font-semibold text-red-700 w-12 text-right">
        {m.live_elapsed ? `${m.live_elapsed}'` : m.live_status || ""}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  group: "Phase de groupes",
  r32: "Seizièmes de finale",
  r16: "Huitièmes de finale",
  qf: "Quarts de finale",
  sf: "Demi-finales",
  third: "Match pour la 3ᵉ place",
  final: "Finale",
};
const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "third", "final"];

function MatchesPage() {
  useRealtimeSync();
  const { user } = useAuth();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, team_a:teams!matches_team_a_id_fkey(name,code), team_b:teams!matches_team_b_id_fkey(name,code)")
        .order("kickoff_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Match[];
    },
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as Prediction[];
    },
  });

  const predByMatch = useMemo(
    () => Object.fromEntries(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  const liveMatches = useMemo(() => {
    const now = Date.now();
    return matches.filter((m) => {
      if (m.finished) return false;
      const ko = new Date(m.kickoff_at).getTime();
      const within = ko <= now && now <= ko + 3 * 60 * 60 * 1000;
      const liveStatus = m.live_status && !["NS", "TBD", "PST", "CANC"].includes(m.live_status);
      return liveStatus || within;
    });
  }, [matches]);




  if (isLoading) {
    return <div className="container mx-auto py-12 text-center text-muted-foreground">Chargement des matchs…</div>;
  }

  return (
    <div className="container mx-auto py-6 px-3 sm:py-8">
      {/* Hero WC2026 */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-blue-950 via-blue-900 to-red-900 p-5 sm:p-6 mb-6 shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-red-500/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg ring-2 ring-amber-200">
            <Trophy className="h-7 w-7 text-amber-950" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.2em] text-amber-300 uppercase">FIFA World Cup 2026</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-50">Pronostics · Coupe du Monde</h1>
            <p className="text-xs text-amber-200/80 mt-0.5">USA · Canada · Mexique — clôture des pronos 1h avant le coup d'envoi</p>
          </div>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-600" /> En direct
          </h2>
          <div className="grid gap-2">
            {liveMatches.map((m) => <LiveRow key={m.id} m={m} />)}
          </div>
        </section>
      )}

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto gap-1 bg-gradient-to-r from-blue-950 to-blue-900 p-1.5 rounded-xl">
          <TabsTrigger value="upcoming" className="gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold"><CalendarClock className="h-4 w-4" />À venir</TabsTrigger>
          <TabsTrigger value="results" className="gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold"><ListChecks className="h-4 w-4" />Résultats</TabsTrigger>
          <TabsTrigger value="standings" className="gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold"><Table2 className="h-4 w-4" />Classements</TabsTrigger>
          <TabsTrigger value="scorers" className="gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold"><Goal className="h-4 w-4" />Buteurs</TabsTrigger>
          <TabsTrigger value="bracket" className="gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold"><Network className="h-4 w-4" />Tableau final</TabsTrigger>
        </TabsList>


        {/* À venir */}
        <TabsContent value="upcoming" className="mt-4 space-y-6">
          {STAGE_ORDER.map((stage) => {
            const items = matches
              .filter((m) => (m.stage || "group") === stage && !m.finished)
              .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
            if (items.length === 0) return null;
            return (
              <section key={stage}>
                <h3 className="text-lg font-bold mb-3">{STAGE_LABELS[stage]}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((m) => (
                    <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
                  ))}
                </div>
              </section>
            );
          })}
          {matches.every((m) => m.finished) && (
            <div className="text-center text-muted-foreground py-8">Tous les matchs sont terminés.</div>
          )}
        </TabsContent>

        {/* Résultats */}
        <TabsContent value="results" className="mt-4 space-y-6">
          {STAGE_ORDER.map((stage) => {
            const items = matches
              .filter((m) => (m.stage || "group") === stage && m.finished)
              .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime());
            if (items.length === 0) return null;
            return (
              <section key={stage}>
                <h3 className="text-lg font-bold mb-2">{STAGE_LABELS[stage]}</h3>
                <div className="space-y-2">
                  {items.map((m) => <ResultRow key={m.id} m={m} />)}
                </div>
              </section>
            );
          })}
        </TabsContent>

        {/* Classements groupes */}
        <TabsContent value="standings" className="mt-4">
          <GroupStandings matches={matches} />
        </TabsContent>

        {/* Buteurs */}
        <TabsContent value="scorers" className="mt-4">
          <TopScorersList />
        </TabsContent>

        {/* Tableau final */}
        <TabsContent value="bracket" className="mt-4">
          <BracketView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Standing = {
  team_id: string;
  name: string;
  code?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

function GroupStandings({ matches }: { matches: Match[] }) {
  const byGroup = useMemo(() => {
    const out: Record<string, Map<string, Standing>> = {};
    for (const m of matches.filter((x) => (x.stage || "group") === "group")) {
      const g = m.group_letter || "?";
      if (!out[g]) out[g] = new Map();
      const ensure = (id: string | null | undefined, name?: string, code?: string | null) => {
        if (!id) return null;
        if (!out[g].has(id)) {
          out[g].set(id, { team_id: id, name: name || "—", code: code || null, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 });
        }
        return out[g].get(id)!;
      };
      const a = ensure(m.team_a_id, m.team_a?.name, m.team_a?.code);
      const b = ensure(m.team_b_id, m.team_b?.name, m.team_b?.code);
      if (!a || !b || m.score_a == null || m.score_b == null || !m.finished) continue;
      a.played++; b.played++;
      a.gf += m.score_a; a.ga += m.score_b;
      b.gf += m.score_b; b.ga += m.score_a;
      if (m.score_a > m.score_b) { a.wins++; a.points += 3; b.losses++; }
      else if (m.score_a < m.score_b) { b.wins++; b.points += 3; a.losses++; }
      else { a.draws++; b.draws++; a.points++; b.points++; }
    }
    const result: Record<string, Standing[]> = {};
    for (const [g, map] of Object.entries(out)) {
      const arr = Array.from(map.values()).map((s) => ({ ...s, gd: s.gf - s.ga }));
      arr.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name));
      result[g] = arr;
    }
    return result;
  }, [matches]);

  const letters = Object.keys(byGroup).sort();
  if (letters.length === 0) return <div className="text-center text-muted-foreground py-8">Aucun classement.</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {letters.map((g) => (
        <Card key={g} className="p-3">
          <h3 className="font-bold mb-2">Groupe {g}</h3>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-1">#</th>
                <th className="text-left px-1">Équipe</th>
                <th className="px-1">J</th>
                <th className="px-1">G</th>
                <th className="px-1">N</th>
                <th className="px-1">P</th>
                <th className="px-1">+/-</th>
                <th className="px-1">Pts</th>
              </tr>
            </thead>
            <tbody>
              {byGroup[g].map((s, i) => (
                <tr key={s.team_id} className="border-t">
                  <td className="px-1 py-1">{i + 1}</td>
                  <td className="px-1 py-1 flex items-center gap-2">
                    {s.code && <img src={flagUrl(s.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                    <span className="truncate">{s.name}</span>
                  </td>
                  <td className="text-center px-1">{s.played}</td>
                  <td className="text-center px-1">{s.wins}</td>
                  <td className="text-center px-1">{s.draws}</td>
                  <td className="text-center px-1">{s.losses}</td>
                  <td className="text-center px-1">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="text-center px-1 font-bold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function TopScorersList() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["top-scorers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, club, goals, assists, teams:team_id(name, code)")
        .gt("goals", 0)
        .order("goals", { ascending: false })
        .order("assists", { ascending: false })
        .order("name", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Chargement…</div>;
  if (data.length === 0) return <div className="text-center text-muted-foreground py-8">Aucun but enregistré.</div>;

  return (
    <Card className="p-3">
      <h3 className="font-bold mb-3 flex items-center gap-2"><Goal className="h-5 w-5" />Classement des buteurs</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1">#</th>
              <th className="text-left px-2 py-1">Joueur</th>
              <th className="text-left px-2 py-1">Sélection</th>
              <th className="text-left px-2 py-1 hidden sm:table-cell">Club</th>
              <th className="text-center px-2 py-1">Buts</th>
              <th className="text-center px-2 py-1">Passes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p: any, i: number) => (
              <tr key={p.id} className="border-t">
                <td className="px-2 py-1 font-bold">{i + 1}</td>
                <td className="px-2 py-1 font-medium">{p.name}</td>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-2">
                    {p.teams?.code && <img src={flagUrl(p.teams.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                    <span className="truncate">{p.teams?.name || "—"}</span>
                  </span>
                </td>
                <td className="px-2 py-1 text-muted-foreground hidden sm:table-cell truncate max-w-[200px]">{p.club || "—"}</td>
                <td className="px-2 py-1 text-center font-bold text-primary">{p.goals}</td>
                <td className="px-2 py-1 text-center">{p.assists || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

