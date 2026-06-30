import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { flagUrl } from "@/lib/flag";
import { formatFR } from "@/lib/time";
import { Trophy, RefreshCw, Radio, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { syncBracketTeamsFn, backfillGoalscorersFn } from "@/lib/bracket-sync.functions";
import { isSequedinSuperAdminFn } from "@/lib/super-admin.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type Team = { name: string; code?: string | null };
type Match = {
  id: string;
  stage: string;
  kickoff_at: string;
  team_a_placeholder: string | null;
  team_b_placeholder: string | null;
  team_a: Team | null;
  team_b: Team | null;
  finished: boolean;
  score_a: number | null;
  score_b: number | null;
  live_status: string | null;
  live_score_a: number | null;
  live_score_b: number | null;
};

type Slot = {
  num: number;
  stage: "r32" | "r16" | "qf" | "sf" | "third" | "final";
  a: string;
  b: string;
};

const SLOTS: Slot[] = [
  { num: 73, stage: "r32", a: "2A", b: "2B" },
  { num: 74, stage: "r32", a: "1C", b: "2F" },
  { num: 75, stage: "r32", a: "1E", b: "3ABCDF" },
  { num: 76, stage: "r32", a: "1F", b: "2C" },
  { num: 77, stage: "r32", a: "2E", b: "2I" },
  { num: 78, stage: "r32", a: "1I", b: "3CDFGH" },
  { num: 79, stage: "r32", a: "1A", b: "3CEFHI" },
  { num: 80, stage: "r32", a: "1L", b: "3EHIJK" },
  { num: 81, stage: "r32", a: "1G", b: "3AEHIJ" },
  { num: 82, stage: "r32", a: "1D", b: "3BEFIJ" },
  { num: 83, stage: "r32", a: "1H", b: "2J" },
  { num: 84, stage: "r32", a: "2K", b: "2L" },
  { num: 85, stage: "r32", a: "1B", b: "3EFGIJ" },
  { num: 86, stage: "r32", a: "2D", b: "2G" },
  { num: 87, stage: "r32", a: "1J", b: "2H" },
  { num: 88, stage: "r32", a: "1K", b: "3DEIJL" },
  { num: 89, stage: "r16", a: "W73", b: "W75" },
  { num: 90, stage: "r16", a: "W74", b: "W77" },
  { num: 91, stage: "r16", a: "W76", b: "W78" },
  { num: 92, stage: "r16", a: "W79", b: "W80" },
  { num: 93, stage: "r16", a: "W83", b: "W84" },
  { num: 94, stage: "r16", a: "W81", b: "W82" },
  { num: 95, stage: "r16", a: "W86", b: "W88" },
  { num: 96, stage: "r16", a: "W85", b: "W87" },
  { num: 97, stage: "qf", a: "W89", b: "W90" },
  { num: 98, stage: "qf", a: "W93", b: "W94" },
  { num: 99, stage: "qf", a: "W91", b: "W92" },
  { num: 100, stage: "qf", a: "W95", b: "W96" },
  { num: 101, stage: "sf", a: "W97", b: "W98" },
  { num: 102, stage: "sf", a: "W99", b: "W100" },
  { num: 103, stage: "third", a: "L101", b: "L102" },
  { num: 104, stage: "final", a: "W101", b: "W102" },
];

function useKnockoutMatches() {
  return useQuery({
    queryKey: ["bracket-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, stage, kickoff_at, team_a_placeholder, team_b_placeholder, finished, score_a, score_b, live_status, live_score_a, live_score_b, team_a:teams!matches_team_a_id_fkey(name,code), team_b:teams!matches_team_b_id_fkey(name,code)",
        )
        .in("stage", ["r32", "r16", "qf", "sf", "third", "final"])
        .order("kickoff_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Match[];
    },
    staleTime: 30_000,
  });
}

type GroupMatch = {
  group_letter: string | null;
  finished: boolean;
  score_a: number | null;
  score_b: number | null;
  team_a: { name: string; code: string | null; group_letter: string | null } | null;
  team_b: { name: string; code: string | null; group_letter: string | null } | null;
};

function useGroupStandings() {
  return useQuery({
    queryKey: ["bracket-group-standings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "group_letter, finished, score_a, score_b, team_a:teams!matches_team_a_id_fkey(name,code,group_letter), team_b:teams!matches_team_b_id_fkey(name,code,group_letter)",
        )
        .eq("stage", "group");
      if (error) throw error;
      return (data || []) as unknown as GroupMatch[];
    },
    staleTime: 30_000,
  });
}

type Standing = { team: Team; pts: number; gd: number; gf: number; group: string };
type StandingsInfo = {
  byGroup: Map<string, Standing[]>;
  completeGroups: Set<string>;
  allComplete: boolean;
};

function computeStandings(groupMatches: GroupMatch[]): StandingsInfo {
  const byGroup = new Map<string, Map<string, Standing>>();
  const totals = new Map<string, { played: number; finished: number }>();
  const ensure = (g: string, code: string, team: Team) => {
    if (!byGroup.has(g)) byGroup.set(g, new Map());
    const m = byGroup.get(g)!;
    if (!m.has(code)) m.set(code, { team, pts: 0, gd: 0, gf: 0, group: g });
    return m.get(code)!;
  };
  for (const m of groupMatches) {
    const g = m.group_letter || m.team_a?.group_letter || m.team_b?.group_letter;
    if (!g) continue;
    const t = totals.get(g) || { played: 0, finished: 0 };
    t.played += 1;
    if (m.finished && m.score_a != null && m.score_b != null) t.finished += 1;
    totals.set(g, t);
    if (!m.finished || m.score_a == null || m.score_b == null) continue;
    if (!m.team_a || !m.team_b) continue;
    const a = ensure(g, m.team_a.code || m.team_a.name, m.team_a);
    const b = ensure(g, m.team_b.code || m.team_b.name, m.team_b);
    a.gf += m.score_a; a.gd += m.score_a - m.score_b;
    b.gf += m.score_b; b.gd += m.score_b - m.score_a;
    if (m.score_a > m.score_b) a.pts += 3;
    else if (m.score_b > m.score_a) b.pts += 3;
    else { a.pts += 1; b.pts += 1; }
  }
  const out = new Map<string, Standing[]>();
  for (const [g, mp] of byGroup) {
    const arr = Array.from(mp.values()).sort((x, y) =>
      y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name),
    );
    out.set(g, arr);
  }
  const completeGroups = new Set<string>();
  for (const [g, t] of totals) {
    if (t.played > 0 && t.played === t.finished) completeGroups.add(g);
  }
  const allComplete = totals.size > 0 && completeGroups.size === totals.size;
  return { byGroup: out, completeGroups, allComplete };
}

function resolveGroupPlaceholder(
  ref: string,
  info: StandingsInfo,
  usedThirds: Set<string>,
): Team | null {
  if (!ref) return null;
  const m1 = ref.match(/^([12])([A-L])$/);
  if (m1) {
    const g = m1[2];
    if (!info.completeGroups.has(g)) return null;
    const pos = parseInt(m1[1]) - 1;
    const arr = info.byGroup.get(g);
    return arr && arr[pos] ? arr[pos].team : null;
  }
  const m3 = ref.match(/^3([A-L]+)$/);
  if (m3) {
    if (!info.allComplete) return null;
    const groups = m3[1].split("");
    const thirds: Standing[] = [];
    for (const g of groups) {
      const arr = info.byGroup.get(g);
      if (arr && arr[2]) thirds.push(arr[2]);
    }
    thirds.sort((x, y) =>
      y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name),
    );
    for (const t of thirds) {
      const key = t.team.code || t.team.name;
      if (!usedThirds.has(key)) {
        usedThirds.add(key);
        return t.team;
      }
    }
  }
  return null;
}

type Resolved = {
  slot: Slot;
  match: Match | null;
  teamA: Team | null;
  teamB: Team | null;
  scoreA: number | null;
  scoreB: number | null;
  isLive: boolean;
  finished: boolean;
  winner: "a" | "b" | null;
};

function resolveAll(matches: Match[], standings: StandingsInfo): Map<number, Resolved> {
  const byKey = new Map<string, Match>();
  for (const m of matches) {
    const a = m.team_a_placeholder || "";
    const b = m.team_b_placeholder || "";
    byKey.set(`${m.stage}|${a}|${b}`, m);
    byKey.set(`${m.stage}|${b}|${a}`, m);
  }
  const out = new Map<number, Resolved>();
  const usedThirds = new Set<string>();
  const winnerOf = (r: Resolved | undefined): Team | null =>
    !r || !r.finished || r.winner == null ? null : r.winner === "a" ? r.teamA : r.teamB;
  const loserOf = (r: Resolved | undefined): Team | null =>
    !r || !r.finished || r.winner == null ? null : r.winner === "a" ? r.teamB : r.teamA;
  const labelFromRef = (ref: string): Team | null => {
    if (ref.startsWith("W")) return winnerOf(out.get(parseInt(ref.slice(1))));
    if (ref.startsWith("L")) return loserOf(out.get(parseInt(ref.slice(1))));
    return resolveGroupPlaceholder(ref, standings, usedThirds);
  };
  for (const slot of SLOTS) {
    const m = byKey.get(`${slot.stage}|${slot.a}|${slot.b}`) || null;
    let teamA: Team | null = m?.team_a ?? null;
    let teamB: Team | null = m?.team_b ?? null;
    if (!teamA) teamA = labelFromRef(slot.a);
    if (!teamB) teamB = labelFromRef(slot.b);
    const isLive = !!m && ["1H", "2H", "HT", "ET", "P", "LIVE"].includes(m.live_status || "");
    const finished = !!m && m.finished && m.score_a != null && m.score_b != null;
    const scoreA = m?.live_score_a ?? m?.score_a ?? null;
    const scoreB = m?.live_score_b ?? m?.score_b ?? null;
    let winner: "a" | "b" | null = null;
    if (finished && m && m.score_a != null && m.score_b != null) {
      if (m.score_a > m.score_b) winner = "a";
      else if (m.score_b > m.score_a) winner = "b";
    }
    out.set(slot.num, { slot, match: m, teamA, teamB, scoreA, scoreB, isLive, finished, winner });
  }
  return out;
}

const STAGE_LABEL: Record<string, string> = {
  r32: "1/16 de finale",
  r16: "1/8 de finale",
  qf: "Quarts de finale",
  sf: "Demi-finales",
  third: "Match pour la 3e place",
  final: "Finale",
};

function TeamLine({
  team,
  placeholder,
  score,
  isWinner,
  isLoser,
}: {
  team: Team | null;
  placeholder: string;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const name = team?.name || placeholder;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${
        isWinner ? "bg-primary/5" : ""
      }`}
    >
      {team?.code ? (
        <img
          src={flagUrl(team.code, 40)}
          alt=""
          className="h-5 w-7 rounded-sm object-cover ring-1 ring-border shrink-0"
        />
      ) : (
        <div className="h-5 w-7 rounded-sm bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
          ?
        </div>
      )}
      <span
        className={`flex-1 text-sm truncate ${
          isWinner ? "font-bold" : isLoser ? "text-muted-foreground" : "font-medium"
        }`}
      >
        {name}
      </span>
      <span
        className={`tabular-nums font-bold text-base w-6 text-right ${
          score == null ? "text-muted-foreground/40" : isWinner ? "text-primary" : ""
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function BracketCard({ r }: { r: Resolved }) {
  const winA = r.winner === "a";
  const winB = r.winner === "b";
  const date = r.match?.kickoff_at ? formatFR(r.match.kickoff_at) : "—";
  return (
    <Card className="overflow-hidden border-border/60 p-0 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/60">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          #{r.slot.num} · {date}
        </span>
        {r.isLive ? (
          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-300 animate-pulse text-[9px] h-4 px-1.5">
            <Radio className="h-2.5 w-2.5 mr-0.5" /> LIVE
          </Badge>
        ) : r.finished ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] h-4 px-1.5">
            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Terminé
          </Badge>
        ) : null}
      </div>
      <TeamLine team={r.teamA} placeholder={r.slot.a} score={r.scoreA} isWinner={winA} isLoser={winB} />
      <div className="h-px bg-border/60" />
      <TeamLine team={r.teamB} placeholder={r.slot.b} score={r.scoreB} isWinner={winB} isLoser={winA} />
    </Card>
  );
}

function StageSection({
  label,
  slots,
  resolved,
}: {
  label: string;
  slots: number[];
  resolved: Map<number, Resolved>;
}) {
  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-border" />
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {slots.map((n) => {
          const r = resolved.get(n);
          if (!r) return null;
          return <BracketCard key={n} r={r} />;
        })}
      </div>
    </section>
  );
}

export function BracketView() {
  const { data: matches, isLoading } = useKnockoutMatches();
  const { data: groupMatches } = useGroupStandings();
  const standings = useMemo(() => computeStandings(groupMatches || []), [groupMatches]);
  const resolved = useMemo(() => resolveAll(matches || [], standings), [matches, standings]);
  const { session } = useAuth();
  const checkSuper = useServerFn(isSequedinSuperAdminFn);
  const { data: isSuper } = useQuery({
    queryKey: ["is-super-admin", session?.user?.id ?? null],
    queryFn: () => checkSuper().then((r: any) => r === true || !!r?.ok).catch(() => false),
    enabled: !!session,
    staleTime: 60_000,
  });
  const qc = useQueryClient();
  const syncFn = useServerFn(syncBracketTeamsFn);
  const backfillFn = useServerFn(backfillGoalscorersFn);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res: any = await syncFn();
      if (!res.ok) toast.error(`Échec : ${res.error}`);
      else {
        toast.success(`Tableau synchronisé : ${res.updated} match(s) mis à jour`);
        qc.invalidateQueries({ queryKey: ["bracket-matches"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inconnue");
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res: any = await backfillFn();
      if (!res.ok) toast.error(`Échec : ${res.error}`);
      else {
        toast.success(`Buteurs rafraîchis : ${res.updated}/${res.processed} match(s)`);
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["bracket-matches"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inconnue");
    } finally {
      setBackfilling(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Chargement du tableau…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-lg font-bold">Tableau final — Coupe du Monde 2026</h2>
            <p className="text-xs text-muted-foreground">Phase à élimination directe, mise à jour en direct.</p>
          </div>
        </div>
        {isSuper && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchro…" : "Synchroniser"}
            </button>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? "animate-spin" : ""}`} />
              {backfilling ? "…" : "Buteurs manquants"}
            </button>
          </div>
        )}
      </div>

      <StageSection
        label={STAGE_LABEL.r32}
        slots={SLOTS.filter((s) => s.stage === "r32").map((s) => s.num)}
        resolved={resolved}
      />
      <StageSection
        label={STAGE_LABEL.r16}
        slots={SLOTS.filter((s) => s.stage === "r16").map((s) => s.num)}
        resolved={resolved}
      />
      <StageSection
        label={STAGE_LABEL.qf}
        slots={SLOTS.filter((s) => s.stage === "qf").map((s) => s.num)}
        resolved={resolved}
      />
      <StageSection
        label={STAGE_LABEL.sf}
        slots={SLOTS.filter((s) => s.stage === "sf").map((s) => s.num)}
        resolved={resolved}
      />
      <StageSection
        label={STAGE_LABEL.third}
        slots={[103]}
        resolved={resolved}
      />
      <StageSection
        label={STAGE_LABEL.final}
        slots={[104]}
        resolved={resolved}
      />
    </div>
  );
}
