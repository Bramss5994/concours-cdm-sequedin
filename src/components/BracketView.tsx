import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { flagUrl } from "@/lib/flag";
import { formatFR } from "@/lib/time";
import { Trophy, RefreshCw } from "lucide-react";
import { syncBracketTeamsFn, backfillGoalscorersFn } from "@/lib/bracket-sync.functions";
import { isSequedinSuperAdminFn } from "@/lib/super-admin.functions";
import { toast } from "sonner";

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

const LEFT_R32 = [73, 75, 74, 77, 81, 82, 83, 84];
const LEFT_R16 = [89, 90, 94, 93];
const LEFT_QF = [97, 98];
const LEFT_SF = 101;

const RIGHT_R32 = [76, 78, 79, 80, 86, 88, 85, 87];
const RIGHT_R16 = [91, 92, 95, 96];
const RIGHT_QF = [99, 100];
const RIGHT_SF = 102;

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
  totalByGroup: Map<string, { played: number; finished: number }>;
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
  return { byGroup: out, completeGroups, totalByGroup: totals, allComplete };
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
  loser: "a" | "b" | null;
};

function resolveAll(
  matches: Match[],
  standings: StandingsInfo,
): Map<number, Resolved> {
  const byKey = new Map<string, Match>();
  for (const m of matches) {
    const a = m.team_a_placeholder || "";
    const b = m.team_b_placeholder || "";
    byKey.set(`${m.stage}|${a}|${b}`, m);
    byKey.set(`${m.stage}|${b}|${a}`, m);
  }

  const out = new Map<number, Resolved>();
  const usedThirds = new Set<string>();

  const winnerOf = (r: Resolved | undefined): Team | null => {
    if (!r || !r.finished || r.winner == null) return null;
    return r.winner === "a" ? r.teamA : r.teamB;
  };
  const loserOf = (r: Resolved | undefined): Team | null => {
    if (!r || !r.finished || r.winner == null) return null;
    return r.winner === "a" ? r.teamB : r.teamA;
  };

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

    const isLive = !!m && (m.live_status === "1H" || m.live_status === "2H" || m.live_status === "HT" || m.live_status === "ET" || m.live_status === "P" || m.live_status === "LIVE");
    const finished = !!m && m.finished && m.score_a != null && m.score_b != null;
    const scoreA = m?.live_score_a ?? m?.score_a ?? null;
    const scoreB = m?.live_score_b ?? m?.score_b ?? null;
    let winner: "a" | "b" | null = null;
    let loser: "a" | "b" | null = null;
    if (finished && m && m.score_a != null && m.score_b != null) {
      if (m.score_a > m.score_b) { winner = "a"; loser = "b"; }
      else if (m.score_b > m.score_a) { winner = "b"; loser = "a"; }
    }

    out.set(slot.num, { slot, match: m, teamA, teamB, scoreA, scoreB, isLive, finished, winner, loser });
  }
  return out;
}

function TeamRow({
  team,
  placeholder,
  score,
  isWinner,
  isLoser,
  align = "left",
}: {
  team: Team | null;
  placeholder: string;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  align?: "left" | "right";
}) {
  const name = team?.name || placeholder;
  const flag = team?.code ? flagUrl(team.code, 40) : null;
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold transition-all ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      } ${isWinner ? "text-white" : isLoser ? "text-white/40 line-through" : "text-white/90"}`}
    >
      {flag ? (
        <img src={flag} alt="" className="h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-white/10 shrink-0" />
      ) : (
        <div className="h-3.5 w-5 rounded-[2px] bg-white/10 shrink-0" />
      )}
      <span className="flex-1 truncate uppercase tracking-wide">{name}</span>
      {score != null && (
        <span
          className={`tabular-nums font-bold text-sm ${
            isWinner ? "text-[color:var(--wc-gold)]" : "text-white/70"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function BMatchCard({ r, align = "left" }: { r: Resolved; align?: "left" | "right" }) {
  const winA = r.winner === "a";
  const winB = r.winner === "b";
  const lostA = r.winner === "b";
  const lostB = r.winner === "a";
  const date = r.match?.kickoff_at ? formatFR(r.match.kickoff_at) : "—";

  return (
    <div
      className="group [perspective:900px] w-[170px] sm:w-[195px]"
      style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.4))" }}
    >
      <div
        className={`relative rounded-md border bg-gradient-to-br from-[color:var(--wc-card-1)] to-[color:var(--wc-card-2)] border-white/10 overflow-hidden transition-transform duration-300 [transform-style:preserve-3d] ${
          align === "right"
            ? "group-hover:[transform:rotateY(-6deg)_rotateX(-2deg)_translateZ(8px)]"
            : "group-hover:[transform:rotateY(6deg)_rotateX(-2deg)_translateZ(8px)]"
        } ${r.isLive ? "ring-2 ring-[color:var(--wc-red)]" : ""}`}
      >
        <div className="px-2 py-0.5 text-[8px] uppercase tracking-[0.15em] font-bold text-white/60 bg-black/30 flex justify-between">
          <span>#{r.slot.num}</span>
          <span>{date}</span>
        </div>
        <TeamRow team={r.teamA} placeholder={r.slot.a} score={r.scoreA} isWinner={winA} isLoser={lostA} />
        <div className="h-px bg-white/10 mx-2" />
        <TeamRow team={r.teamB} placeholder={r.slot.b} score={r.scoreB} isWinner={winB} isLoser={lostB} />
        {r.isLive && (
          <div className="absolute top-1 right-1 flex items-center gap-1 text-[8px] font-bold text-white bg-[color:var(--wc-red)] px-1.5 py-0.5 rounded-full">
            <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
      </div>
    </div>
  );
}

function StageLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] font-bold text-[color:var(--wc-gold)] text-center mb-2">
      {children}
    </div>
  );
}

function Column({
  label,
  align = "left",
  children,
}: {
  label: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-around gap-3 shrink-0">
      <StageLabel>{label}</StageLabel>
      <div className={`flex flex-col justify-around flex-1 gap-3 ${align === "right" ? "items-end" : "items-start"}`}>
        {children}
      </div>
    </div>
  );
}

export function BracketView() {
  const { data: matches, isLoading } = useKnockoutMatches();
  const { data: groupMatches } = useGroupStandings();
  const standings = useMemo(() => computeStandings(groupMatches || []), [groupMatches]);
  const resolved = useMemo(() => resolveAll(matches || [], standings), [matches, standings]);
  const checkSuper = useServerFn(isSequedinSuperAdminFn);
  const { data: isSuper } = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: () => checkSuper().then((r: any) => !!r?.ok).catch(() => false),
    staleTime: 60_000,
  });
  const qc = useQueryClient();
  const syncFn = useServerFn(syncBracketTeamsFn);
  const backfillFn = useServerFn(backfillGoalscorersFn);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const r = (n: number): Resolved => resolved.get(n)!;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res: any = await syncFn();
      if (!res.ok) {
        toast.error(`Échec : ${res.error}`);
      } else {
        toast.success(`Tableau synchronisé : ${res.updated} match(s) mis à jour`);
        if (res.errors?.length) {
          console.warn("Sync warnings:", res.errors);
          toast.warning(`${res.errors.length} avertissement(s) — voir console`);
        }
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
      if (!res.ok) {
        toast.error(`Échec : ${res.error}`);
      } else {
        toast.success(`Buteurs rafraîchis : ${res.updated}/${res.processed} match(s)`);
        if (res.errors?.length) {
          console.warn("Backfill warnings:", res.errors);
          toast.warning(`${res.errors.length} en attente — relancez si besoin`);
        }
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["bracket-matches"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inconnue");
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-b from-[#0a0e2c] via-[#0d1a3a] to-[#0a0e2c] text-white">
      <style>{`
        :root {
          --wc-red: #e30613;
          --wc-blue: #2541b2;
          --wc-green: #009739;
          --wc-gold: #f5c542;
          --wc-card-1: rgba(20, 30, 70, 0.95);
          --wc-card-2: rgba(10, 18, 45, 0.95);
        }
      `}</style>
      <div className="px-3 py-6">
        <div className="text-center mb-6">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--wc-gold)]">
            Coupe du Monde 2026
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mt-1">TABLEAU FINAL</h2>
          <p className="text-xs text-white/60 mt-1">
            Mis à jour en temps réel · des 16es à la finale
          </p>
          {isSuper && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--wc-gold)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronisation…" : "Synchroniser via API Football"}
            </button>
          )}
        </div>


        {isLoading ? (
          <p className="text-center text-white/60 py-20">Chargement…</p>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3 pb-4">
            <div className="min-w-[1400px] flex items-stretch justify-between gap-2">
              <Column label="16es">
                {LEFT_R32.map((n) => <BMatchCard key={n} r={r(n)} />)}
              </Column>
              <Column label="8es">
                {LEFT_R16.map((n) => <BMatchCard key={n} r={r(n)} />)}
              </Column>
              <Column label="Quarts">
                {LEFT_QF.map((n) => <BMatchCard key={n} r={r(n)} />)}
              </Column>
              <Column label="Demi">
                <BMatchCard r={r(LEFT_SF)} />
              </Column>

              <div className="flex flex-col items-center justify-center gap-4 shrink-0 px-2">
                <StageLabel>Finale</StageLabel>
                <div className="relative">
                  <div className="absolute inset-0 -m-3 rounded-full bg-[color:var(--wc-gold)]/20 blur-2xl animate-pulse" />
                  <div className="relative">
                    <BMatchCard r={r(104)} />
                  </div>
                </div>
                <div className="my-2 [perspective:600px]">
                  <Trophy
                    className="h-20 w-20 sm:h-28 sm:w-28 text-[color:var(--wc-gold)] drop-shadow-[0_0_20px_rgba(245,197,66,0.6)] animate-[spin_18s_linear_infinite]"
                    style={{ transformStyle: "preserve-3d" }}
                  />
                </div>
                <StageLabel>3e place</StageLabel>
                <BMatchCard r={r(103)} />
              </div>

              <Column label="Demi" align="right">
                <BMatchCard r={r(RIGHT_SF)} align="right" />
              </Column>
              <Column label="Quarts" align="right">
                {RIGHT_QF.map((n) => <BMatchCard key={n} r={r(n)} align="right" />)}
              </Column>
              <Column label="8es" align="right">
                {RIGHT_R16.map((n) => <BMatchCard key={n} r={r(n)} align="right" />)}
              </Column>
              <Column label="16es" align="right">
                {RIGHT_R32.map((n) => <BMatchCard key={n} r={r(n)} align="right" />)}
              </Column>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-white/40 mt-4">
          Glissez horizontalement pour explorer le tableau →
        </p>
      </div>
    </div>
  );
}
