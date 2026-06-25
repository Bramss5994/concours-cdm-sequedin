import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isLocked, formatFR, LOCK_MS } from "@/lib/time";
import { toast } from "sonner";
import { Trophy, Lock, CheckCircle2, Radio, Goal } from "lucide-react";
import { flagUrl, flagSrcSet } from "@/lib/flag";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { BracketView } from "@/components/BracketView";
import m6Logo from "@/assets/m6.png.asset.json";
import beinLogo from "@/assets/bein.png.asset.json";

export const Route = createFileRoute("/matches")({ component: MatchesPage });

type Goalscorer = {
  minute: number | null;
  extra: number | null;
  team: string;
  player: string;
  api_player_id?: number | null;
  assist?: string | null;
  type?: string;
  side?: "home" | "away" | null;
};

type Match = {
  id: string;
  kickoff_at: string;
  stadium: string;
  stage?: string;
  matchday?: number | null;
  group_letter?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a: { name: string; code?: string } | null;
  team_b: { name: string; code?: string } | null;
  team_a_placeholder?: string | null;
  team_b_placeholder?: string | null;
  finished: boolean;
  score_a: number | null;
  score_b: number | null;
  live_status?: string | null;
  live_score_a?: number | null;
  live_score_b?: number | null;
  live_elapsed?: number | null;
  goalscorers?: Goalscorer[] | null;
};

type Prediction = {
  match_id: string;
  score_a: number;
  score_b: number;
  points?: number | null;
  exact_score?: boolean | null;
  good_winner?: boolean | null;
};

type TeamStanding = {
  team_id: string;
  name: string;
  code?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

function computeGroupStandings(matches: Match[]): Record<string, TeamStanding[]> {
  const groups: Record<string, Map<string, TeamStanding>> = {};
  for (const m of (matches || []).filter((x) => x.stage === "group")) {
    const g = m.group_letter || "?";
    if (!groups[g]) groups[g] = new Map();
    const map = groups[g];
    const ensure = (teamId: string | null | undefined, teamName?: string, code?: string | null) => {
      if (!teamId) return null;
      if (!map.has(teamId)) {
        map.set(teamId, {
          team_id: teamId,
          name: teamName || "—",
          code: code || undefined,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, goal_diff: 0, points: 0,
        });
      }
      return map.get(teamId)!;
    };
    const a = ensure(m.team_a_id, m.team_a?.name, m.team_a?.code);
    const b = ensure(m.team_b_id, m.team_b?.name, m.team_b?.code);
    if (!a || !b || !m.finished || m.score_a == null || m.score_b == null) continue;
    a.played++; b.played++;
    a.goals_for += m.score_a; a.goals_against += m.score_b;
    b.goals_for += m.score_b; b.goals_against += m.score_a;
    if (m.score_a > m.score_b) { a.wins++; a.points += 3; b.losses++; }
    else if (m.score_a < m.score_b) { b.wins++; b.points += 3; a.losses++; }
    else { a.draws++; b.draws++; a.points++; b.points++; }
  }
  const result: Record<string, TeamStanding[]> = {};
  for (const [g, map] of Object.entries(groups)) {
    const arr = Array.from(map.values()).map((s) => ({ ...s, goal_diff: s.goals_for - s.goals_against }));
    arr.sort((x, y) =>
      y.points - x.points ||
      y.goal_diff - x.goal_diff ||
      y.goals_for - x.goals_for ||
      x.name.localeCompare(y.name),
    );
    result[g] = arr;
  }
  return result;
}

function TeamBlock({ team, placeholder, align = "center" }: { team: Match["team_a"]; placeholder?: string | null; align?: "center" | "left" | "right" }) {
  const name = team?.name || placeholder || "À déterminer";
  return (
    <div className={`flex flex-col items-${align} gap-2 min-w-0`}>
      {team?.code ? (
        <img
          src={flagUrl(team.code, 80)}
          srcSet={flagSrcSet(team.code)}
          alt={name}
          className="h-10 w-14 rounded-sm object-cover ring-1 ring-border shadow-sm"
        />
      ) : (
        <div className="h-10 w-14 rounded-sm bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
          {name.charAt(0)}
        </div>
      )}
      <span className="font-semibold text-sm text-center leading-tight truncate max-w-[110px]">{name}</span>
    </div>
  );
}

type Broadcaster = { name: string; logo: string };

const BROADCASTERS: Record<string, Broadcaster> = {
  bein: {
    name: "beIN SPORTS",
    logo: beinLogo.url,
  },
  m6: {
    name: "M6",
    logo: m6Logo.url,
  },
};

// Normalise un nom (minuscule, sans accents, sans non-alpha) pour comparer
// les noms d'équipes peu importe l'orthographe.
function normTeam(s?: string | null): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

// Clé d'une rencontre indépendante de l'ordre (team_a/team_b).
function pairKey(a?: string | null, b?: string | null): string {
  return [normTeam(a), normTeam(b)].sort().join("|");
}

// Liste officielle (L'Équipe) des matchs de phase de groupes diffusés sur M6.
// Tous les matchs de la France, les demi-finales, la 3e place et la finale
// sont également sur M6 (gérés par règle ci-dessous).
const M6_GROUP_PAIRS = new Set<string>(
  [
    ["Espagne", "Cap-Vert"],
    ["Belgique", "Égypte"],
    ["Arabie saoudite", "Uruguay"],
    ["France", "Sénégal"],
    ["Irak", "Norvège"],
    ["Portugal", "RD Congo"],
    ["Angleterre", "Croatie"],
    ["République tchèque", "Afrique du Sud"],
    ["Suisse", "Bosnie-Herzégovine"],
    ["États-Unis", "Australie"],
    ["Etats-Unis", "Australie"],
    ["Écosse", "Maroc"],
    ["Ecosse", "Maroc"],
    ["Pays-Bas", "Suède"],
    ["Allemagne", "Côte d'Ivoire"],
    ["Espagne", "Arabie saoudite"],
    ["Belgique", "Iran"],
    ["Argentine", "Autriche"],
    ["France", "Irak"],
    ["Portugal", "Ouzbékistan"],
    ["Angleterre", "Ghana"],
    ["Suisse", "Canada"],
    ["Écosse", "Brésil"],
    ["Ecosse", "Brésil"],
    ["Maroc", "Haïti"],
    ["Équateur", "Allemagne"],
    ["Equateur", "Allemagne"],
    ["Tunisie", "Pays-Bas"],
    ["Norvège", "France"],
    ["Panama", "Angleterre"],
    ["Croatie", "Ghana"],
    ["Colombie", "Portugal"],
    // Matchs déjà passés diffusés sur M6 (jeudi 11 → dimanche 14 juin)
    ["Mexique", "Afrique du Sud"],
    ["Corée du Sud", "République tchèque"],
    ["Canada", "Bosnie-Herzégovine"],
    ["États-Unis", "Paraguay"],
    ["Etats-Unis", "Paraguay"],
    ["Qatar", "Suisse"],
    ["Brésil", "Maroc"],
    ["Haïti", "Écosse"],
    ["Haïti", "Ecosse"],
    ["Australie", "Turquie"],
    ["Allemagne", "Curaçao"],
    ["Pays-Bas", "Japon"],
    ["Côte d'Ivoire", "Équateur"],
    ["Côte d'Ivoire", "Equateur"],
    ["Suède", "Tunisie"],
  ].map(([a, b]) => pairKey(a, b)),
);

function teamIsFrance(t?: { name?: string; code?: string } | null): boolean {
  if (!t) return false;
  if (t.code === "FRA") return true;
  return normTeam(t.name) === "france";
}

function getBroadcasters(match: Match): Broadcaster[] {
  const list: Broadcaster[] = [BROADCASTERS.bein];
  const stage = match.stage || "";
  const involvesFrance = teamIsFrance(match.team_a) || teamIsFrance(match.team_b);
  const lateStage = stage === "sf" || stage === "third" || stage === "final";
  const onM6 =
    involvesFrance ||
    lateStage ||
    M6_GROUP_PAIRS.has(pairKey(match.team_a?.name, match.team_b?.name)) ||
    M6_GROUP_PAIRS.has(pairKey(match.team_a_placeholder, match.team_b_placeholder));
  if (onM6) list.push(BROADCASTERS.m6);
  return list;
}

function BroadcastersList({ match }: { match: Match }) {
  const bc = getBroadcasters(match);
  if (bc.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Diffusion
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {bc.map((b) => (
            <span
              key={b.name}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1 shadow-sm"
              title={b.name}
            >
              <img
                src={b.logo}
                alt={b.name}
                className="h-4 w-auto object-contain"
                loading="lazy"
              />
              {b.name !== "M6" && b.name !== "beIN SPORTS" && (
                <span className="text-[10px] font-semibold text-foreground/80">{b.name}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalscorersList({ goalscorers, teamA, teamB }: {
  goalscorers: Goalscorer[];
  teamA?: string;
  teamB?: string;
}) {
  if (!goalscorers || goalscorers.length === 0) return null;
  const sorted = [...goalscorers].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  // Les noms d'équipes côté API sont en anglais (ex: "Sweden") alors que la DB
  // les stocke en français (ex: "Suède"). On groupe par g.team tel quel, puis
  // on tente d'assigner chaque groupe au bon côté (A/B) du match. À défaut,
  // on conserve l'ordre d'apparition.
  const teamsInGoals = Array.from(new Set(sorted.map((g) => g.team)));
  const norm = (s?: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
  const matchScore = (apiName: string, dbName?: string) => {
    if (!dbName) return 0;
    const a = norm(apiName);
    const b = norm(dbName);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.startsWith(b) || b.startsWith(a)) return 80;
    const prefix = Math.min(a.length, b.length, 4);
    let common = 0;
    for (let i = 0; i < prefix; i++) if (a[i] === b[i]) common++;
    return common * 5;
  };

  let leftTeamApi: string | null = null;
  let rightTeamApi: string | null = null;
  if (teamsInGoals.length >= 1) {
    const ranked = teamsInGoals.map((t) => ({
      t,
      a: matchScore(t, teamA),
      b: matchScore(t, teamB),
    }));
    // Best A match wins left side
    const bestA = ranked.slice().sort((x, y) => y.a - x.a)[0];
    if (bestA && bestA.a > 0) leftTeamApi = bestA.t;
    const remaining = ranked.filter((r) => r.t !== leftTeamApi);
    const bestB = remaining.slice().sort((x, y) => y.b - x.b)[0];
    if (bestB && bestB.b > 0) rightTeamApi = bestB.t;
    // Fallbacks: keep apparition order
    if (!leftTeamApi) leftTeamApi = teamsInGoals[0] || null;
    if (!rightTeamApi)
      rightTeamApi = teamsInGoals.find((t) => t !== leftTeamApi) || null;
  }

  const aGoals = sorted.filter((g) => g.team === leftTeamApi);
  const bGoals = sorted.filter((g) => g.team === rightTeamApi);

  const renderGoal = (g: Goalscorer, i: number) => {
    const minute = g.minute != null ? `${g.minute}${g.extra ? `+${g.extra}` : ""}'` : "";
    const icon = g.type === "own" ? "🔴" : g.type === "penalty" ? "🅿" : "⚽";
    return (
      <div key={i} className="flex items-baseline gap-1.5 text-xs">
        <span>{icon}</span>
        <span className="font-medium truncate">{g.player}</span>
        <span className="text-muted-foreground tabular-nums">{minute}</span>
      </div>
    );
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
        <Goal className="h-3 w-3" /> Buteurs
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          {aGoals.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">—</span>
          ) : (
            aGoals.map(renderGoal)
          )}
        </div>
        <div className="space-y-1 [&>div]:flex-row-reverse [&>div]:justify-start [&>div]:text-right">
          {bGoals.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">—</span>
          ) : (
            bGoals.map(renderGoal)
          )}
        </div>
      </div>
    </div>
  );
}

function LockCountdown({ kickoff }: { kickoff: string }) {
  const lockTime = new Date(kickoff).getTime() - LOCK_MS;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = lockTime - now;
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const urgent = ms < 60 * 60 * 1000; // < 1h
  const veryUrgent = ms < 10 * 60 * 1000; // < 10min

  let display: string;
  if (d > 0) display = `${d}j ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  else if (h > 0) display = `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  else display = `${m}m ${String(s).padStart(2, "0")}s`;

  return (
    <div
      className={`flex items-center justify-center gap-1.5 text-xs font-medium rounded-md py-1.5 px-2 ${
        veryUrgent
          ? "bg-red-100 text-red-800 animate-pulse"
          : urgent
            ? "bg-amber-100 text-amber-800"
            : "bg-muted text-muted-foreground"
      }`}
    >
      <Lock className="h-3 w-3" />
      <span>Clôture dans</span>
      <span className="font-bold tabular-nums">{display}</span>
    </div>
  );
}

function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [stats, setStats] = useState<{ total_votes: number; perc_a: number; perc_b: number; perc_draw: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // re-sync local inputs when the prediction updates (realtime sync)
  useEffect(() => {
    if (prediction) {
      setScoreA(String(prediction.score_a));
      setScoreB(String(prediction.score_b));
    }
  }, [prediction?.score_a, prediction?.score_b]);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_match_stats", { match_id_param: match.id }).then(({ data }) => {
      if (!cancelled && data && data.length > 0) setStats(data[0] as any);
    });
    return () => { cancelled = true; };
  }, [match.id, prediction?.score_a, prediction?.score_b]);

  const locked = isLocked(match.kickoff_at);
  const isLive = !match.finished && match.live_status && match.live_status !== "NS";

  async function save() {
    if (!user) { toast.error("Connectez-vous pour enregistrer un pronostic."); return; }
    const a = Number(scoreA); const b = Number(scoreB);
    if (scoreA === "" || scoreB === "" || Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      toast.error("Veuillez saisir deux scores valides."); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("predictions")
        .upsert({ user_id: user.id, match_id: match.id, score_a: a, score_b: b }, { onConflict: "user_id,match_id" });
      if (error) toast.error(`Erreur : ${error.message}`);
      else {
        toast.success("Pronostic enregistré");
        qc.invalidateQueries({ queryKey: ["predictions"] });
      }
    } finally { setBusy(false); }
  }

  // status badge
  const statusBadge = match.finished ? (
    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-300">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Terminé
    </Badge>
  ) : isLive ? (
    <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-300 animate-pulse">
      <Radio className="h-3 w-3 mr-1" /> {match.live_elapsed ? `${match.live_elapsed}'` : "En direct"}
    </Badge>
  ) : locked ? (
    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
      <Lock className="h-3 w-3 mr-1" /> Verrouillé
    </Badge>
  ) : (
    <Badge variant="outline">Ouvert</Badge>
  );

  const showScore = match.finished || isLive;
  const displayA = isLive ? match.live_score_a ?? 0 : match.score_a;
  const displayB = isLive ? match.live_score_b ?? 0 : match.score_b;

  return (
    <Card className="relative overflow-hidden border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>{match.kickoff_at ? formatFR(match.kickoff_at) : "—"}</span>
        {statusBadge}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <TeamBlock team={match.team_a} placeholder={match.team_a_placeholder} />
        <div className="text-center min-w-[60px]">
          {showScore ? (
            <div className="text-3xl font-extrabold tabular-nums">
              {displayA ?? "–"} <span className="text-muted-foreground">:</span> {displayB ?? "–"}
            </div>
          ) : (
            <div className="text-lg font-bold text-muted-foreground">VS</div>
          )}
          {match.stadium && <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[120px]">{match.stadium}</div>}
        </div>
        <TeamBlock team={match.team_b} placeholder={match.team_b_placeholder} />
      </div>

      {/* Prediction form OR result row */}
      {!match.finished ? (
        <div className="space-y-3">
          {!locked && <LockCountdown kickoff={match.kickoff_at} />}
          <div className="flex items-center justify-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              disabled={busy || locked}
              placeholder="0"
              className="w-16 p-2 border rounded-lg text-center font-bold text-lg bg-background disabled:opacity-60"
            />
            <span className="font-bold text-muted-foreground">-</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              disabled={busy || locked}
              placeholder="0"
              className="w-16 p-2 border rounded-lg text-center font-bold text-lg bg-background disabled:opacity-60"
            />
            <Button onClick={save} disabled={busy || locked} size="sm" className="ml-2">
              {prediction ? "Modifier" : "Valider"}
            </Button>
          </div>
          {locked && (
            <p className="text-center text-xs text-amber-700">
              Pronostics fermés (1h avant le coup d'envoi).
            </p>
          )}
          {prediction && !locked && (
            <p className="text-center text-xs text-muted-foreground">
              Votre pronostic actuel : <span className="font-semibold">{prediction.score_a} - {prediction.score_b}</span>
            </p>
          )}
        </div>
      ) : (
        prediction && (
          <div className="flex items-center justify-center gap-3 text-sm bg-muted/40 rounded-md py-2">
            <span className="text-muted-foreground">Votre prono :</span>
            <span className="font-semibold">{prediction.score_a} - {prediction.score_b}</span>
            <Badge variant={prediction.points && prediction.points > 0 ? "default" : "secondary"}>
              {prediction.points ?? 0} pt{(prediction.points ?? 0) > 1 ? "s" : ""}
            </Badge>
          </div>
        )
      )}

      {/* Stats bar (community predictions) - only before kickoff */}
      {!match.finished && !isLive && stats && stats.total_votes > 0 && (
        <div className="mt-3">
          <div className="flex w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="bg-primary h-full" style={{ width: `${stats.perc_a}%` }} title={`${match.team_a?.name}: ${stats.perc_a}%`} />
            <div className="bg-muted-foreground/40 h-full" style={{ width: `${stats.perc_draw}%` }} title={`Nul: ${stats.perc_draw}%`} />
            <div className="bg-accent h-full" style={{ width: `${stats.perc_b}%` }} title={`${match.team_b?.name}: ${stats.perc_b}%`} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{stats.perc_a}%</span>
            <span>Nul {stats.perc_draw}%</span>
            <span>{stats.perc_b}%</span>
          </div>
        </div>
      )}

      {/* Goalscorers (after sync) */}
      {(match.finished || isLive) && match.goalscorers && match.goalscorers.length > 0 && (
        <GoalscorersList
          goalscorers={match.goalscorers}
          teamA={match.team_a?.name}
          teamB={match.team_b?.name}
        />
      )}

      {/* Diffuseurs TV */}
      <BroadcastersList match={match} />
    </Card>
  );
}

function MatchesPage() {
  useRealtimeSync();
  const { user } = useAuth();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*)")
        .order("kickoff_at", { ascending: true });
      return (data || []) as Match[];
    },
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("predictions").select("*").eq("user_id", user!.id);
      return (data || []) as Prediction[];
    },
  });

  const predByMatch = useMemo(
    () => Object.fromEntries(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );
  const groupStandings = useMemo(() => computeGroupStandings(matches), [matches]);
  const groupLetters = Object.keys(groupStandings).sort();

  const now = Date.now();
  const liveMatches = matches.filter((m) => {
    if (m.finished) return false;
    if (m.live_status && m.live_status !== "NS") return true;
    const k = new Date(m.kickoff_at).getTime();
    return k <= now && now <= k + 2.5 * 60 * 60 * 1000;
  });
  const finishedMatches = matches.filter((m) => m.finished).sort(
    (a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime(),
  );
  const upcomingMatches = matches.filter((m) => !m.finished && !liveMatches.includes(m)).sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-primary h-7 w-7" />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Pronostics — Coupe du Monde 2026</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des matchs…</p>
      ) : (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="flex flex-wrap gap-2 h-auto">
            <TabsTrigger value="upcoming">À venir ({upcomingMatches.length})</TabsTrigger>
            <TabsTrigger value="live">
              <Radio className="h-3 w-3 mr-1" /> En direct ({liveMatches.length})
            </TabsTrigger>
            <TabsTrigger value="finished">Terminés ({finishedMatches.length})</TabsTrigger>
            {groupLetters.length > 0 && <TabsTrigger value="groups">Classements</TabsTrigger>}
            <TabsTrigger value="bracket">Tableau final</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {upcomingMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun match à venir.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingMatches.map((m) => (
                  <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="mt-4">
            {liveMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun match en direct.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {liveMatches.map((m) => (
                  <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="finished" className="mt-4">
            {finishedMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun match terminé.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {finishedMatches.map((m) => (
                  <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
                ))}
              </div>
            )}
          </TabsContent>

          {groupLetters.length > 0 && (
            <TabsContent value="groups" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {groupLetters.map((g) => (
                  <Card key={g} className="p-4">
                    <h3 className="font-bold mb-3">Groupe {g === "?" ? "Non attribué" : g}</h3>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left py-1">Équipe</th>
                          <th className="text-center px-1">J</th>
                          <th className="text-center px-1">+/-</th>
                          <th className="text-center px-1">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStandings[g].map((t, i) => (
                          <tr key={t.team_id} className="border-t">
                            <td className="py-1.5 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                              {t.code && <img src={flagUrl(t.code, 40)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}
                              <span>{t.name}</span>
                            </td>
                            <td className="text-center px-1">{t.played}</td>
                            <td className="text-center px-1">{t.goal_diff > 0 ? `+${t.goal_diff}` : t.goal_diff}</td>
                            <td className="text-center px-1 font-bold">{t.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="bracket" className="mt-4">
            <BracketView />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
