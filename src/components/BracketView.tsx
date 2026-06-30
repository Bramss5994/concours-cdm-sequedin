import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { flagUrl } from "@/lib/flag";
import { Trophy, RefreshCw, Radio, Pencil, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  syncBracketTeamsFn,
  backfillGoalscorersFn,
  updateBracketMatchAsSuperFn,
  listTeamsForBracketFn,
} from "@/lib/bracket-sync.functions";
import { isSequedinSuperAdminFn } from "@/lib/super-admin.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type Team = { id?: string; name: string; code?: string | null };
type Match = {
  id: string;
  stage: string;
  kickoff_at: string;
  stadium?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a_placeholder: string | null;
  team_b_placeholder: string | null;
  team_a: Team | null;
  team_b: Team | null;
  finished: boolean;
  score_a: number | null;
  score_b: number | null;
  score_a_et?: number | null;
  score_b_et?: number | null;
  score_a_pen?: number | null;
  score_b_pen?: number | null;
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

const STAGE_LABEL: Record<Slot["stage"], string> = {
  r32: "16es de FINALE",
  r16: "8es de FINALE",
  qf: "1/4 FINALES",
  sf: "1/2 FINALES",
  third: "3e PLACE",
  final: "FINALE",
};

function useKnockoutMatches() {
  return useQuery({
    queryKey: ["bracket-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, stage, kickoff_at, stadium, team_a_id, team_b_id, team_a_placeholder, team_b_placeholder, finished, score_a, score_b, score_a_et, score_b_et, score_a_pen, score_b_pen, live_status, live_score_a, live_score_b, team_a:teams!matches_team_a_id_fkey(id,name,code), team_b:teams!matches_team_b_id_fkey(id,name,code)",
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
  penA: number | null;
  penB: number | null;
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
    const penA = m?.score_a_pen ?? null;
    const penB = m?.score_b_pen ?? null;
    let winner: "a" | "b" | null = null;
    if (finished && m && m.score_a != null && m.score_b != null) {
      if (m.score_a > m.score_b) winner = "a";
      else if (m.score_b > m.score_a) winner = "b";
      else if (penA != null && penB != null) winner = penA > penB ? "a" : penB > penA ? "b" : null;
    }
    out.set(slot.num, {
      slot, match: m, teamA, teamB, scoreA, scoreB, penA, penB, isLive, finished, winner,
    });
  }
  return out;
}

function formatHeader(m: Match | null): string {
  if (!m?.kickoff_at) return "Date à venir";
  const d = new Date(m.kickoff_at);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  const hour = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const stad = m.stadium ? `, ${m.stadium}` : "";
  return `${day} à ${hour}${stad}`;
}

function TeamRow({
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
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 ${
        isWinner ? "bg-amber-50/80 dark:bg-amber-950/30" : ""
      }`}
    >
      {team?.code ? (
        <img
          src={flagUrl(team.code, 40)}
          alt=""
          className="h-5 w-7 rounded-sm object-cover ring-1 ring-border shrink-0"
        />
      ) : (
        <div className="h-5 w-7 rounded-sm bg-muted shrink-0 grid place-items-center text-[10px] text-muted-foreground font-bold">
          ?
        </div>
      )}
      <span
        className={`text-[13px] truncate ${
          isWinner ? "font-extrabold text-foreground" : isLoser ? "text-muted-foreground" : "font-semibold"
        }`}
      >
        {name}
      </span>
      <span
        className={`tabular-nums font-extrabold text-sm w-6 h-6 grid place-items-center rounded ${
          score == null
            ? "text-muted-foreground/40 bg-muted/40"
            : isWinner
            ? "bg-amber-400 text-amber-950"
            : "bg-muted text-foreground"
        }`}
      >
        {score ?? "-"}
      </span>
    </div>
  );
}

function EditDialog({
  r,
  teams,
  onClose,
  onSaved,
}: {
  r: Resolved;
  teams: { id: string; name: string; code: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const m = r.match;
  const updateFn = useServerFn(updateBracketMatchAsSuperFn);
  const [teamA, setTeamA] = useState<string>(m?.team_a_id ?? "");
  const [teamB, setTeamB] = useState<string>(m?.team_b_id ?? "");
  const [sa, setSa] = useState<string>(m?.score_a != null ? String(m.score_a) : "");
  const [sb, setSb] = useState<string>(m?.score_b != null ? String(m.score_b) : "");
  const [pa, setPa] = useState<string>(m?.score_a_pen != null ? String(m.score_a_pen) : "");
  const [pb, setPb] = useState<string>(m?.score_b_pen != null ? String(m.score_b_pen) : "");
  const [finished, setFinished] = useState<boolean>(!!m?.finished);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!m) return;
    setBusy(true);
    try {
      const num = (v: string) => (v === "" ? null : Number(v));
      await updateFn({
        data: {
          id: m.id,
          team_a_id: teamA || null,
          team_b_id: teamB || null,
          score_a: num(sa),
          score_b: num(sb),
          score_a_pen: num(pa),
          score_b_pen: num(pb),
          finished,
        },
      });
      toast.success(`Match #${r.slot.num} mis à jour`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Échec mise à jour");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg">Match #{r.slot.num} · {STAGE_LABEL[r.slot.stage]}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Équipe A ({r.slot.a})</label>
            <select value={teamA} onChange={(e) => setTeamA(e.target.value)} className="w-full p-2 border rounded-lg bg-background">
              <option value="">— Aucune —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Équipe B ({r.slot.b})</label>
            <select value={teamB} onChange={(e) => setTeamB(e.target.value)} className="w-full p-2 border rounded-lg bg-background">
              <option value="">— Aucune —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Score A</label>
              <input type="number" min={0} value={sa} onChange={(e) => setSa(e.target.value)} className="w-full p-2 border rounded-lg bg-background text-center font-bold" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Score B</label>
              <input type="number" min={0} value={sb} onChange={(e) => setSb(e.target.value)} className="w-full p-2 border rounded-lg bg-background text-center font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Tirs au but A</label>
              <input type="number" min={0} value={pa} onChange={(e) => setPa(e.target.value)} className="w-full p-2 border rounded-lg bg-background text-center" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Tirs au but B</label>
              <input type="number" min={0} value={pb} onChange={(e) => setPb(e.target.value)} className="w-full p-2 border rounded-lg bg-background text-center" />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} />
            <span className="text-sm font-semibold">Match terminé</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={save} disabled={busy} className="gap-2">
            <Save className="h-4 w-4" />{busy ? "…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  r,
  isSuper,
  teams,
  onEdit,
}: {
  r: Resolved;
  isSuper: boolean;
  teams: { id: string; name: string; code: string | null }[];
  onEdit: () => void;
}) {
  const winA = r.winner === "a";
  const winB = r.winner === "b";
  const hasPen = r.penA != null && r.penB != null;

  return (
    <div className="rounded-md overflow-hidden border border-blue-900/30 bg-white shadow-md ring-1 ring-amber-300/30">
      <div className="flex items-center justify-between px-2.5 py-1 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-amber-200">
        <span className="text-[10px] font-bold tracking-wider truncate">
          #{r.slot.num} · {formatHeader(r.match)}
        </span>
        <div className="flex items-center gap-1">
          {r.isLive && (
            <Badge className="bg-red-600 text-white border-red-700 animate-pulse h-4 text-[9px] px-1 gap-0.5">
              <Radio className="h-2.5 w-2.5" />LIVE
            </Badge>
          )}
          {isSuper && (
            <button
              onClick={onEdit}
              title="Modifier"
              className="p-0.5 rounded hover:bg-amber-400/20 text-amber-300"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <TeamRow team={r.teamA} placeholder={r.slot.a} score={r.scoreA} isWinner={winA} isLoser={winB} />
      <div className="h-px bg-border" />
      <TeamRow team={r.teamB} placeholder={r.slot.b} score={r.scoreB} isWinner={winB} isLoser={winA} />

      {hasPen && (
        <div className="px-2.5 py-1 text-[10px] text-center font-semibold text-amber-700 bg-amber-50 border-t">
          t.a.b. {r.penA}-{r.penB}
        </div>
      )}
    </div>
  );
}

function StageColumn({
  label,
  slots,
  resolved,
  isSuper,
  teams,
  onEdit,
}: {
  label: string;
  slots: number[];
  resolved: Map<number, Resolved>;
  isSuper: boolean;
  teams: { id: string; name: string; code: string | null }[];
  onEdit: (r: Resolved) => void;
}) {
  return (
    <div className="flex-1 min-w-[220px] space-y-3">
      <h3 className="text-center text-[11px] font-black tracking-[0.15em] uppercase text-amber-100 bg-gradient-to-r from-red-700 via-red-600 to-red-700 py-1.5 rounded-md shadow-md ring-1 ring-amber-300/40">
        {label}
      </h3>
      <div className="space-y-3">
        {slots.map((n) => {
          const r = resolved.get(n);
          if (!r) return null;
          return <MatchCard key={n} r={r} isSuper={isSuper} teams={teams} onEdit={() => onEdit(r)} />;
        })}
      </div>
    </div>
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

  const listTeams = useServerFn(listTeamsForBracketFn);
  const { data: teams = [] } = useQuery({
    queryKey: ["bracket-teams-list", session?.user?.id ?? null],
    queryFn: () => listTeams().catch(() => []) as Promise<{ id: string; name: string; code: string | null }[]>,
    enabled: !!isSuper,
    staleTime: 5 * 60_000,
  });

  const qc = useQueryClient();
  const syncFn = useServerFn(syncBracketTeamsFn);
  const backfillFn = useServerFn(backfillGoalscorersFn);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [editing, setEditing] = useState<Resolved | null>(null);

  // Realtime: refresh quand un match est modifié
  useEffect(() => {
    const ch = supabase
      .channel(`bracket-realtime-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["bracket-matches"] });
        qc.invalidateQueries({ queryKey: ["bracket-group-standings"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

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

  const r32 = SLOTS.filter((s) => s.stage === "r32").map((s) => s.num);
  const r16 = SLOTS.filter((s) => s.stage === "r16").map((s) => s.num);
  const qf = SLOTS.filter((s) => s.stage === "qf").map((s) => s.num);
  const sf = SLOTS.filter((s) => s.stage === "sf").map((s) => s.num);

  const onEdit = (r: Resolved) => setEditing(r);

  return (
    <div className="space-y-5">
      <div className="rounded-xl overflow-hidden border-2 border-amber-400/60 bg-gradient-to-br from-blue-950 via-blue-900 to-red-900 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg ring-2 ring-amber-200">
              <Trophy className="h-6 w-6 text-amber-950" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-amber-100 tracking-tight">
                PHASE FINALE · Coupe du Monde 2026
              </h2>
              <p className="text-xs text-amber-200/80 font-medium">
                Du 16e de finale à la finale · mise à jour en temps réel
              </p>
            </div>
          </div>
          {isSuper && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-50 shadow"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Synchro…" : "Synchroniser"}
              </button>
              <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/60 bg-blue-950/60 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-blue-900/60 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? "animate-spin" : ""}`} />
                {backfilling ? "…" : "Buteurs"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-blue-50 via-white to-amber-50 p-3 sm:p-5 ring-1 ring-border overflow-x-auto">
        <div className="flex gap-3 sm:gap-4 min-w-[1100px]">
          <StageColumn label={STAGE_LABEL.r32} slots={r32} resolved={resolved} isSuper={!!isSuper} teams={teams} onEdit={onEdit} />
          <StageColumn label={STAGE_LABEL.r16} slots={r16} resolved={resolved} isSuper={!!isSuper} teams={teams} onEdit={onEdit} />
          <StageColumn label={STAGE_LABEL.qf} slots={qf} resolved={resolved} isSuper={!!isSuper} teams={teams} onEdit={onEdit} />
          <StageColumn label={STAGE_LABEL.sf} slots={sf} resolved={resolved} isSuper={!!isSuper} teams={teams} onEdit={onEdit} />
          <div className="flex-1 min-w-[220px] space-y-6">
            <div className="space-y-3">
              <h3 className="text-center text-[11px] font-black tracking-[0.15em] uppercase text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 py-1.5 rounded-md shadow-md ring-1 ring-amber-500/60">
                {STAGE_LABEL.final}
              </h3>
              {[104].map((n) => {
                const r = resolved.get(n);
                return r ? <MatchCard key={n} r={r} isSuper={!!isSuper} teams={teams} onEdit={() => onEdit(r)} /> : null;
              })}
            </div>
            <div className="space-y-3">
              <h3 className="text-center text-[11px] font-black tracking-[0.15em] uppercase text-white bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 py-1.5 rounded-md shadow ring-1 ring-slate-300/60">
                {STAGE_LABEL.third}
              </h3>
              {[103].map((n) => {
                const r = resolved.get(n);
                return r ? <MatchCard key={n} r={r} isSuper={!!isSuper} teams={teams} onEdit={() => onEdit(r)} /> : null;
              })}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditDialog
          r={editing}
          teams={teams}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["bracket-matches"] });
            qc.invalidateQueries({ queryKey: ["matches"] });
          }}
        />
      )}
    </div>
  );
}
