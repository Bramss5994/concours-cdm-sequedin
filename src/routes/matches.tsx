import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Button3D } from "@/components/Button3D";
import { Badge } from "@/components/ui/badge";
import { isLocked, formatFR, timeUntilLock } from "@/lib/time";
import { toast } from "sonner";
import { Trophy, Lock, Radio, CalendarClock, ListChecks, Table2, Goal, Network, Pencil } from "lucide-react";
import { flagUrl, flagSrcSet } from "@/lib/flag";
import { Flag3D } from "@/components/Flag3D";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { BracketView } from "@/components/BracketView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { isSequedinSuperAdminFn } from "@/lib/super-admin.functions";
import { updateBracketMatchAsSuperFn } from "@/lib/bracket-sync.functions";
import { syncLiveNowFn } from "@/lib/live-sync.functions";
import { syncTopScorersNowFn } from "@/lib/topscorers-sync.functions";
import { LIVE_STATUS_LABEL } from "@/lib/livescores.shared";




export const Route = createFileRoute("/matches")({ component: MatchesPage });

type GoalScorer = {
  minute: number | null;
  extra?: number | null;
  team?: string | null;
  player: string;
  side?: "a" | "b" | null;
  type?: string | null;
};

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
  goalscorers?: GoalScorer[] | null;
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

function MatchVoteBar({ matchId, nameA, nameB }: { matchId: string; nameA: string; nameB: string }) {
  const { data } = useQuery({
    queryKey: ["match-stats", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_match_stats", { match_id_param: matchId });
      if (error) throw error;
      return (data?.[0] ?? null) as { total_votes: number; perc_a: number; perc_b: number; perc_draw: number } | null;
    },
    staleTime: 60_000,
  });
  if (!data || !data.total_votes) {
    return (
      <div className="mt-3 text-center text-[11px] text-muted-foreground border-t pt-2">
        Aucun pronostic pour l'instant
      </div>
    );
  }
  const a = Number(data.perc_a) || 0;
  const b = Number(data.perc_b) || 0;
  const d = Number(data.perc_draw) || 0;
  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
        <span>{nameA} {a}%</span>
        <span>Nul {d}%</span>
        <span>{b}% {nameB}</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-primary" style={{ width: `${a}%` }} />
        <div className="bg-muted-foreground/40" style={{ width: `${d}%` }} />
        <div className="bg-destructive" style={{ width: `${b}%` }} />
      </div>
      <div className="text-center text-[10px] text-muted-foreground mt-1">
        {data.total_votes} pronostic{data.total_votes > 1 ? "s" : ""}
      </div>
    </div>
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
          <Flag3D code={match.team_a?.code} name={teamName(match, "a")} size="sm" />
          <span className="font-bold text-sm leading-tight">{teamName(match, "a")}</span>
        </div>
        <div className="text-xs text-muted-foreground font-semibold">VS</div>
        <div className="flex flex-col items-center gap-1 text-center">
          <Flag3D code={match.team_b?.code} name={teamName(match, "b")} size="sm" />
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
            <Button3D
              onClick={save}
              disabled={busy}
              variant={prediction ? "gold" : "success"}
              size="md"
              className="ml-2"
            >
              {prediction ? "Modifier" : "Valider"}
            </Button3D>
          </div>
          <div className="text-center text-[11px] text-muted-foreground mt-2">
            {timeUntilLock(match.kickoff_at)}
          </div>
        </>
      )}
      <MatchVoteBar matchId={match.id} nameA={teamName(match, "a")} nameB={teamName(match, "b")} />
    </Card>
  );
}

function useIsSuperAdmin() {
  const { session } = useAuth();
  const checkSuper = useServerFn(isSequedinSuperAdminFn);
  const { data } = useQuery({
    queryKey: ["is-super-admin", session?.user?.id ?? null],
    queryFn: () => checkSuper().then((r: any) => r === true || !!r?.ok).catch(() => false),
    enabled: !!session,
    staleTime: 60_000,
  });
  return !!data;
}

function SuperAdminMatchEdit({ m }: { m: Match }) {
  const isSuper = useIsSuperAdmin();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateBracketMatchAsSuperFn);
  const [open, setOpen] = useState(false);
  const [scoreA, setScoreA] = useState<string>(m.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState<string>(m.score_b?.toString() ?? "");
  const [etA, setEtA] = useState<string>(m.score_a_et?.toString() ?? "");
  const [etB, setEtB] = useState<string>(m.score_b_et?.toString() ?? "");
  const [penA, setPenA] = useState<string>(m.score_a_pen?.toString() ?? "");
  const [penB, setPenB] = useState<string>(m.score_b_pen?.toString() ?? "");
  const [status, setStatus] = useState<string>(((m.live_status || (m.finished ? "FT" : "NS")) as string).toUpperCase());
  const [busy, setBusy] = useState(false);

  if (!isSuper) return null;

  const num = (s: string) => (s === "" ? null : Number(s));
  const save = async () => {
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: m.id,
          score_a: num(scoreA),
          score_b: num(scoreB),
          score_a_et: status === "AET" || status === "PEN" ? num(etA) : null,
          score_b_et: status === "AET" || status === "PEN" ? num(etB) : null,
          score_a_pen: status === "PEN" ? num(penA) : null,
          score_b_pen: status === "PEN" ? num(penB) : null,
          live_status: status,
          finished: ["FT", "AET", "PEN"].includes(status),
        },
      });
      toast.success("Match mis à jour");
      qc.invalidateQueries({ queryKey: ["matches"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-700" aria-label="Modifier le score">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{teamName(m, "a")} – {teamName(m, "b")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Statut final</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NS">À venir</SelectItem>
                <SelectItem value="FT">Terminé (temps réglementaire)</SelectItem>
                <SelectItem value="AET">Terminé après prolongation (a.p.)</SelectItem>
                <SelectItem value="PEN">Terminé aux tirs au but (t.a.b.)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Score final (incluant prolongation)</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min={0} value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="w-16 p-2 border rounded text-center font-bold" />
              <span>-</span>
              <input type="number" min={0} value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="w-16 p-2 border rounded text-center font-bold" />
            </div>
          </div>
          {(status === "AET" || status === "PEN") && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Score à la fin des prolongations</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={0} value={etA} onChange={(e) => setEtA(e.target.value)} className="w-16 p-2 border rounded text-center" />
                <span>-</span>
                <input type="number" min={0} value={etB} onChange={(e) => setEtB(e.target.value)} className="w-16 p-2 border rounded text-center" />
              </div>
            </div>
          )}
          {status === "PEN" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tirs au but</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={0} value={penA} onChange={(e) => setPenA(e.target.value)} className="w-16 p-2 border rounded text-center font-bold text-amber-700" />
                <span>-</span>
                <input type="number" min={0} value={penB} onChange={(e) => setPenB(e.target.value)} className="w-16 p-2 border rounded text-center font-bold text-amber-700" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
          <Button onClick={save} disabled={busy}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({ m }: { m: Match }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground w-28 hidden sm:block">{formatFR(m.kickoff_at)}</div>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="truncate font-medium text-right">{teamName(m, "a")}</span>
          <Flag3D code={m.team_a?.code} name={teamName(m, "a")} size="sm" />
        </div>
        <div className="px-2 flex items-center">
          <FinalScore m={m} />
          <ExtraTimeBadge m={m} />
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Flag3D code={m.team_b?.code} name={teamName(m, "b")} size="sm" />
          <span className="truncate font-medium">{teamName(m, "b")}</span>
        </div>
        <SuperAdminMatchEdit m={m} />
      </div>
      <ScorersGrid m={m} tone="result" />
    </div>
  );
}


function LiveStatusChip({ m }: { m: Match }) {
  const s = (m.live_status || "").toUpperCase();
  const label = LIVE_STATUS_LABEL[s] || s || "LIVE";
  const showClock = ["1H", "2H", "ET"].includes(s) && m.live_elapsed != null;
  const blink = ["HT", "BT"].includes(s) ? "" : "animate-pulse";
  return (
    <div className="flex items-center gap-2">
      <Badge className={`bg-red-600 text-white ${blink}`}>
        <Radio className="h-3 w-3 mr-1" />LIVE
      </Badge>
      <span className="text-[11px] font-bold uppercase tracking-wide text-red-700">
        {showClock ? `${m.live_elapsed}'` : label}
      </span>
    </div>
  );
}

function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Recalcule le côté ("a"|"b") d'un buteur à l'affichage à partir des noms
 *  DB, pour corriger les anciennes valeurs "home"/"away" ou les côtés nulls. */
function resolveGoalSide(g: GoalScorer, m: Match): "a" | "b" | null {
  if (g.side === "a" || g.side === "b") return g.side;
  const t = normalizeName(g.team || "");
  const na = normalizeName(m.team_a?.name || "");
  const nb = normalizeName(m.team_b?.name || "");
  if (!t) return null;
  if (t === na || (na && (na.startsWith(t) || t.startsWith(na)))) return "a";
  if (t === nb || (nb && (nb.startsWith(t) || t.startsWith(nb)))) return "b";
  // Compat: ancien format home/away
  if ((g.side as any) === "home") return "a";
  if ((g.side as any) === "away") return "b";
  return null;
}

function ScorersGrid({ m, tone = "live" }: { m: Match; tone?: "live" | "result" }) {
  const goals = Array.isArray(m.goalscorers) ? m.goalscorers : [];
  if (goals.length === 0) return null;
  const withSide = goals.map((g) => ({ ...g, _side: resolveGoalSide(g, m) }));
  const left = withSide.filter((g) => g._side === "a");
  const right = withSide.filter((g) => g._side === "b");
  const orphans = withSide.filter((g) => g._side !== "a" && g._side !== "b");
  const fmtMin = (g: GoalScorer) =>
    g.minute != null ? `${g.minute}${g.extra ? `+${g.extra}` : ""}'` : "";
  const minColor = tone === "live" ? "text-red-700" : "text-amber-700";
  const borderColor = tone === "live" ? "border-red-200" : "border-amber-200";
  const renderItem = (g: GoalScorer, key: string) => (
    <li key={key} className="truncate">
      <span className={`font-mono ${minColor}`}>{fmtMin(g)}</span>{" "}
      <span className="font-medium">{g.player}</span>
      {g.type === "own" && <span className="text-muted-foreground"> (csc)</span>}
      {g.type === "penalty" && <span className="text-muted-foreground"> (p)</span>}
    </li>
  );
  return (
    <div className={`mt-2 grid grid-cols-2 gap-2 border-t ${borderColor} pt-2 text-[11px]`}>
      <ul className="space-y-0.5 text-right">{left.map((g, i) => renderItem(g, `a${i}`))}</ul>
      <ul className="space-y-0.5">{right.map((g, i) => renderItem(g, `b${i}`))}</ul>
      {orphans.length > 0 && (
        <ul className="col-span-2 space-y-0.5 text-center text-muted-foreground">
          {orphans.map((g, i) => renderItem(g, `o${i}`))}
        </ul>
      )}
    </div>
  );
}

function LiveScorersList({ m }: { m: Match }) {
  return <ScorersGrid m={m} tone="live" />;
}

function LiveRow({ m }: { m: Match }) {
  const a = m.live_score_a ?? m.score_a;
  const b = m.live_score_b ?? m.score_b;
  const s = (m.live_status || "").toUpperCase();
  const showPen = s === "P" || (m.score_a_pen != null && m.score_b_pen != null);
  return (
    <div className="rounded-xl border-2 border-red-400 bg-gradient-to-br from-red-50 to-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <LiveStatusChip m={m} />
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="truncate font-semibold text-right">{teamName(m, "a")}</span>
          <Flag3D code={m.team_a?.code} name={teamName(m, "a")} size="sm" />
        </div>
        <div className="flex flex-col items-center">
          <div className="font-mono text-xl font-black tabular-nums tracking-tight">
            {a ?? 0} - {b ?? 0}
          </div>
          {showPen && m.score_a_pen != null && m.score_b_pen != null && (
            <div className="text-[10px] font-bold text-amber-700">
              t.a.b. {m.score_a_pen}-{m.score_b_pen}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Flag3D code={m.team_b?.code} name={teamName(m, "b")} size="sm" />
          <span className="truncate font-semibold">{teamName(m, "b")}</span>
        </div>
      </div>
      <LiveScorersList m={m} />
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

  // Poll API-Football toutes les 30s tant qu'un match peut être en direct,
  // pour rafraîchir scores, temps, statut (HT/ET/P) et buteurs.
  const qc = useQueryClient();
  const syncLive = useServerFn(syncLiveNowFn);
  const hasPotentialLive = useMemo(() => {
    const now = Date.now();
    return matches.some((m) => {
      if (m.finished) return false;
      const ko = new Date(m.kickoff_at).getTime();
      return ko - 5 * 60 * 1000 <= now && now <= ko + 3 * 60 * 60 * 1000;
    });
  }, [matches]);
  useEffect(() => {
    if (!user || !hasPotentialLive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r: any = await syncLive();
        if (!cancelled && r?.ok && (r.updatedMatches > 0 || r.goalUpdates > 0)) {
          qc.invalidateQueries({ queryKey: ["matches"] });
        }
      } catch {
        // silencieux : pas critique
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user, hasPotentialLive, syncLive, qc]);





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
        <div className="-mx-2 px-2 overflow-x-auto sm:mx-0 sm:px-0 sm:overflow-visible">
          <TabsList className="inline-flex w-max sm:w-full sm:grid sm:grid-cols-5 h-auto gap-1 bg-gradient-to-r from-blue-950 to-blue-900 p-1.5 rounded-xl">
            <TabsTrigger value="upcoming" className="shrink-0 gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold whitespace-nowrap"><CalendarClock className="h-4 w-4" />À venir</TabsTrigger>
            <TabsTrigger value="results" className="shrink-0 gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold whitespace-nowrap"><ListChecks className="h-4 w-4" />Résultats</TabsTrigger>
            <TabsTrigger value="standings" className="shrink-0 gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold whitespace-nowrap"><Table2 className="h-4 w-4" />Classements</TabsTrigger>
            <TabsTrigger value="scorers" className="shrink-0 gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold whitespace-nowrap"><Goal className="h-4 w-4" />Buteurs</TabsTrigger>
            <TabsTrigger value="bracket" className="shrink-0 gap-1 data-[state=active]:bg-amber-400 data-[state=active]:text-amber-950 text-amber-100 font-bold whitespace-nowrap"><Network className="h-4 w-4" />Tableau final</TabsTrigger>
          </TabsList>
        </div>


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
                    <Flag3D code={s.code} name={s.name} size="xs" />
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
  const qc = useQueryClient();

  // Agrège les buteurs à partir des goalscorers de chaque match terminé
  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["top-scorers-from-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, finished, goalscorers, team_a:teams!matches_team_a_id_fkey(name,code), team_b:teams!matches_team_b_id_fkey(name,code)")
        .eq("finished", true);
      if (error) throw error;
      type Agg = { name: string; goals: number; teamName: string; teamCode?: string };
      const map = new Map<string, Agg>();
      for (const m of (data || []) as any[]) {
        const gs: GoalScorer[] = Array.isArray(m.goalscorers) ? m.goalscorers : [];
        for (const g of gs) {
          if (!g?.player) continue;
          if (g.type === "own") continue; // csc n'est pas attribué au buteur adverse
          const side = g.side === "b" ? "b" : g.side === "a" ? "a" : null;
          const team = side === "b" ? m.team_b : side === "a" ? m.team_a : null;
          const key = `${g.player.toLowerCase().trim()}|${team?.code || team?.name || ""}`;
          const cur = map.get(key);
          if (cur) cur.goals += 1;
          else map.set(key, { name: g.player, goals: 1, teamName: team?.name || "—", teamCode: team?.code });
        }
      }
      return [...map.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 50);
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Realtime : toute mise à jour d'un match rafraîchit la liste
  useEffect(() => {
    const ch = supabase
      .channel(`scorers-from-matches-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["top-scorers-from-matches"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Chargement…</div>;
  if (data.length === 0) return <div className="text-center text-muted-foreground py-8">Aucun but enregistré.</div>;

  const updatedLabel = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-bold flex items-center gap-2"><Goal className="h-5 w-5" />Classement des buteurs</h3>
        <span className="text-[10px] inline-flex items-center gap-1 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Temps réel · {updatedLabel}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1">#</th>
              <th className="text-left px-2 py-1">Joueur</th>
              <th className="text-left px-2 py-1">Sélection</th>
              <th className="text-center px-2 py-1">Buts</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={`${p.name}-${p.teamCode || p.teamName}-${i}`} className="border-t">
                <td className="px-2 py-1 font-bold">{i + 1}</td>
                <td className="px-2 py-1 font-medium">{p.name}</td>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-2">
                    <Flag3D code={p.teamCode} name={p.teamName} size="xs" />
                    <span className="truncate">{p.teamName}</span>
                  </span>
                </td>
                <td className="px-2 py-1 text-center font-bold text-primary">{p.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


