import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button3D } from "@/components/Button3D";
import { Lock, CheckCircle2, MapPin, Trophy, Minus, Plus, Radio, Tv, Calendar as CalendarIcon, Users } from "lucide-react";
import { flagSrcSet } from "@/lib/flag";
import { formatFR, isLocked, lockMessage, timeUntilLock } from "@/lib/time";
import { teamPalette } from "@/lib/team-colors";
import { getChannels } from "@/lib/broadcast";
import { toast } from "sonner";


export const Route = createFileRoute("/matches")({ component: MatchesPage });

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

type Team = { id: string; code: string; name: string; group_letter: string | null };
type Goalscorer = {
  minute: number | null;
  extra: number | null;
  team: string;
  player: string;
  api_player_id: number | null;
  assist: string | null;
  type: "goal" | "penalty" | "own" | "missed";
};
type Match = {
  id: string; stage: string; group_letter: string | null; matchday: number | null;
  kickoff_at: string; stadium: string | null;
  team_a_id: string | null; team_b_id: string | null;
  team_a_placeholder: string | null; team_b_placeholder: string | null;
  score_a: number | null; score_b: number | null; finished: boolean;
  team_a: Team | null; team_b: Team | null;
  goalscorers?: Goalscorer[] | null;
};

type Prediction = { match_id: string; score_a: number; score_b: number; points: number };
type MatchStats = { a: number; b: number; draw: number; total: number };

const STAGES: { value: string; label: string }[] = [
  { value: "calendar", label: "Calendrier" },
  { value: "group", label: "Phase de groupes" },
  { value: "ko", label: "Phase finale" },
];

const KO_STAGES = ["r32", "r16", "qf", "sf", "third", "final"];
const KO_LABEL: Record<string, string> = {
  r32: "16es de finale", r16: "8es de finale", qf: "Quarts de finale",
  sf: "Demi-finales", third: "Match pour la 3e place", final: "Finale",
};

function MatchesPage() {
  const { user, loading } = useAuth();
  const [stage, setStage] = useState("calendar");

  // Récupération des matchs
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, team_a:teams!matches_team_a_id_fkey(id,code,name,group_letter), team_b:teams!matches_team_b_id_fkey(id,code,name,group_letter)")
        .order("kickoff_at");
      if (error) throw error;
      return data as unknown as Match[];
    },
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  // Récupération des pronostics de l'utilisateur connecté
  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("match_id, score_a, score_b, points").eq("user_id", user!.id);
      if (error) throw error;
      return data as Prediction[];
    },
  });

  // Récupération de TOUS les pronostics pour faire les statistiques (anonymisé)
  const { data: allPredictions = [] } = useQuery({
    queryKey: ["all_predictions_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("match_id, score_a, score_b");
      if (error) throw error;
      return data as { match_id: string; score_a: number; score_b: number }[];
    },
  });

  const predByMatch = useMemo(() => Object.fromEntries(predictions.map((p) => [p.match_id, p])), [predictions]);

  // Calcul des statistiques globales par match
  const statsByMatch = useMemo(() => {
    const stats: Record<string, MatchStats> = {};
    for (const p of allPredictions) {
      if (!stats[p.match_id]) stats[p.match_id] = { a: 0, b: 0, draw: 0, total: 0 };
      const s = stats[p.match_id];
      s.total++;
      if (p.score_a > p.score_b) s.a++;
      else if (p.score_a < p.score_b) s.b++;
      else s.draw++;
    }
    return stats;
  }, [allPredictions]);

  if (loading) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl font-bold sm:text-3xl"
      >Coupe du Monde 2026 — Calendrier & pronostics</motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-1 text-sm text-muted-foreground"
      >104 matchs • 16 villes hôtes • Canada · Mexique · États-Unis. Pronostics fermés 1h avant chaque match.</motion.p>

      {!user && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="mt-4 border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <p className="text-sm">Connectez-vous pour pronostiquer.</p>
              <Button asChild size="sm"><Link to="/auth">Se connecter</Link></Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <Tabs value={stage} onValueChange={setStage} className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {STAGES.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            {isLoading ? <SkeletonGrid />
              : <CalendarView matches={matches} predByMatch={predByMatch} canPredict={!!user} statsByMatch={statsByMatch} />}
          </TabsContent>

          <TabsContent value="group" className="mt-4">
            {isLoading ? <SkeletonGrid />
              : <GroupedMatches matches={matches.filter(m => m.stage === "group")} predByMatch={predByMatch} canPredict={!!user} statsByMatch={statsByMatch} />}
          </TabsContent>

          <TabsContent value="ko" className="mt-4 space-y-8">
            {isLoading ? <SkeletonGrid />
              : KO_STAGES.map((st) => {
                const list = matches.filter(m => m.stage === st);
                if (!list.length) return null;
                return (
                  <motion.section
                    key={st}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-primary" />{KO_LABEL[st]}</h2>
                    <MatchList matches={list} predByMatch={predByMatch} canPredict={!!user} statsByMatch={statsByMatch} />
                  </motion.section>
                );
              })}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse overflow-hidden rounded-xl border bg-gradient-to-br from-muted/60 to-muted/20" />
      ))}
    </div>
  );
}

function CalendarView({ matches, predByMatch, canPredict, statsByMatch }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean; statsByMatch: Record<string, MatchStats> }) {
  const parisDateKey = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(iso));
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${d}`;
  };
  const byDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const key = parisDateKey(m.kickoff_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);
  const todayKey = parisDateKey(new Date().toISOString());

  return (
    <div className="space-y-6">
      {byDate.map(([day, list]) => {
        const d = new Date(day + "T12:00:00Z");
        const weekday = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long" });
        const dayNum = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric" });
        const month = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "short" });
        const isToday = day === todayKey;
        return (
          <motion.section
            key={day}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4 }}
          >
            <div className={`sticky top-0 z-10 -mx-2 mb-3 flex items-center gap-3 rounded-lg px-2 py-2 backdrop-blur-md ${isToday ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" : "bg-background/80"}`}>
              <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg shadow-md ${isToday ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground" : "bg-muted text-foreground"}`}>
                <span className="text-lg font-black leading-none">{dayNum}</span>
                <span className="text-[9px] font-bold uppercase leading-none opacity-80">{month}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold capitalize">{weekday}</span>
                  {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Aujourd'hui</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{list.length} match{list.length > 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={staggerContainer}
              className="grid gap-3 md:grid-cols-2"
            >
              {list.map((m, i) => (
                <motion.div key={m.id} variants={fadeUp} custom={i}>
                  <MatchCard match={m} prediction={predByMatch[m.id]} canPredict={canPredict} stats={statsByMatch[m.id]} />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        );
      })}
    </div>
  );
}

function GroupedMatches({ matches, predByMatch, canPredict, statsByMatch }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean; statsByMatch: Record<string, MatchStats> }) {
  const groups: Record<string, Match[]> = {};
  for (const m of matches) {
    const g = m.group_letter || "?";
    (groups[g] ||= []).push(m);
  }
  const letters = Object.keys(groups).sort();
  return (
    <div className="space-y-6">
      {letters.map((g) => (
        <motion.section
          key={g}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Trophy className="h-5 w-5 text-primary" /> Groupe {g}</h2>
          <GroupTable matches={groups[g]} />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="mt-3 grid gap-3 md:grid-cols-2"
          >
            {groups[g].map((m, i) => (
              <motion.div key={m.id} variants={fadeUp} custom={i}>
                <MatchCard match={m} prediction={predByMatch[m.id]} canPredict={canPredict} stats={statsByMatch[m.id]} />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      ))}
    </div>
  );
}

function GroupTable({ matches }: { matches: Match[] }) {
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
            <tr key={r.code} className="border-t transition-colors hover:bg-muted/40">
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

function MatchList({ matches, predByMatch, canPredict, statsByMatch }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean; statsByMatch: Record<string, MatchStats> }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={staggerContainer}
      className="grid gap-3 md:grid-cols-2"
    >
      {matches.map((m, i) => (
        <motion.div key={m.id} variants={fadeUp} custom={i}>
          <MatchCard match={m} prediction={predByMatch[m.id]} canPredict={canPredict} stats={statsByMatch[m.id]} />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Live countdown badge — updates every second
function LiveCountdown({ kickoff }: { kickoff: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const k = new Date(kickoff).getTime();
  const ms = k - 60 * 60 * 1000 - Date.now();
  if (ms <= 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
      <Lock className="h-3 w-3" /> Fermé
    </span>
  );
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const urgent = ms < 6 * 3600 * 1000;
  const label = d > 0 ? `${d}j ${h}h ${m}min` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tabular-nums ${urgent ? "animate-pulse bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-success/15 text-success"}`}>
      <CheckCircle2 className="h-3 w-3" /> {label}
    </span>
  );
}

// LED-style stepper input
function ScoreStepper({ value, onChange, disabled, color }: { value: string; onChange: (v: string) => void; disabled: boolean; color: string }) {
  const n = value === "" ? 0 : Number(value);
  const set = (next: number) => onChange(String(Math.max(0, Math.min(20, next))));
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => set(n + 1)}
        disabled={disabled}
        className="flex h-5 w-10 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-40"
        aria-label="Incrémenter"
      >
        <Plus className="h-3 w-3" />
      </button>
      <div
        className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border-2 shadow-inner"
        style={{
          borderColor: color + "55",
          background: "linear-gradient(180deg, #0a0a0f 0%, #15151c 100%)",
          boxShadow: `inset 0 2px 6px rgba(0,0,0,.6), 0 0 12px ${color}33`,
        }}
      >
        <input
          type="number"
          min={0}
          max={20}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          inputMode="numeric"
          className="absolute inset-0 w-full bg-transparent text-white text-center font-mono text-2xl font-black tabular-nums outline-none disabled:cursor-not-allowed"
          style={{ textShadow: `0 0 8px ${color}, 0 0 2px ${color}` }}
        />
      </div>
      <button
        type="button"
        onClick={() => set(n - 1)}
        disabled={disabled}
        className="flex h-5 w-10 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-40"
        aria-label="Décrémenter"
      >
        <Minus className="h-3 w-3" />
      </button>
    </div>
  );
}

function ChannelBadge({ name }: { name: string }) {
  const isM6 = name === "M6";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-sm ring-1 ${
        isM6
          ? "bg-gradient-to-b from-fuchsia-500 to-fuchsia-700 text-white ring-fuchsia-900/40"
          : "bg-gradient-to-b from-red-500 to-red-700 text-white ring-red-900/40"
      }`}
    >
      <Tv className="h-2.5 w-2.5" /> {name}
    </span>
  );
}

function GoalTimeline({ goals, teamA, teamB }: { goals: Goalscorer[]; teamA: string; teamB: string }) {
  const max = Math.max(95, ...goals.map((g) => (g.minute ?? 0) + (g.extra ?? 0)));
  return (
    <div className="relative mt-2 h-10">
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      {[0, 45, 90].map((tick) => (
        <div key={tick} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(tick / max) * 100}%` }}>
          <div className="h-2 w-px bg-muted-foreground/40" />
          <div className="mt-0.5 text-[8px] text-muted-foreground">{tick}'</div>
        </div>
      ))}
      {goals.filter((g) => g.type !== "missed").map((g, i) => {
        const min = (g.minute ?? 0) + (g.extra ?? 0);
        const pct = Math.min(100, (min / max) * 100);
        const isA = g.team === teamA;
        const icon = g.type === "penalty" ? "🅿" : g.type === "own" ? "🔴" : "⚽";
        return (
          <div
            key={i}
            className="group absolute -translate-x-1/2"
            style={{ left: `${pct}%`, top: isA ? "0" : "auto", bottom: isA ? "auto" : "0" }}
            title={`${g.player} — ${min}'`}
          >
            <div className="text-sm">{icon}</div>
          </div>
        );
      })}
    </div>
  );
}

function MatchCard({ match, prediction, canPredict, stats }: { match: Match; prediction?: Prediction; canPredict: boolean; stats?: MatchStats }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const showFinalScore = match.finished && match.score_a != null && match.score_b != null;
  const locked = isLocked(match.kickoff_at);
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScoreA(prediction ? String(prediction.score_a) : "");
    setScoreB(prediction ? String(prediction.score_b) : "");
  }, [prediction?.score_a, prediction?.score_b]);

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
    else { toast.success("✓ Pronostic enregistré"); qc.invalidateQueries({ queryKey: ["predictions"] }); qc.invalidateQueries({ queryKey: ["all_predictions_stats"] }); }
  }

  const nameA = match.team_a?.name || match.team_a_placeholder || "À déterminer";
  const nameB = match.team_b?.name || match.team_b_placeholder || "À déterminer";
  const codeA = match.team_a?.code;
  const codeB = match.team_b?.code;
  const palA = teamPalette(codeA);
  const palB = teamPalette(codeB);

  // Status color for left border
  const statusColor = match.finished
    ? "#FFD100" // gold
    : locked
    ? "#E4002B" // red
    : "#00A86B"; // green

  const cardBg = `linear-gradient(135deg, ${palA.primary}14 0%, transparent 45%, ${palB.primary}14 100%)`;

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Card
        className="relative overflow-hidden border-0 shadow-md ring-1 ring-border transition-shadow duration-300 hover:shadow-xl"
        style={{ background: cardBg }}
      >
        {/* Status side bar */}
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: statusColor, boxShadow: `0 0 12px ${statusColor}` }} />
        {/* Faint flag watermarks */}
        {codeA && (
          <img
            src={`https://flagcdn.com/w80/${codeA}.png`}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -left-4 top-1/2 h-24 w-32 -translate-y-1/2 object-cover opacity-[0.06] blur-sm"
          />
        )}
        {codeB && (
          <img
            src={`https://flagcdn.com/w80/${codeB}.png`}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-4 top-1/2 h-24 w-32 -translate-y-1/2 object-cover opacity-[0.06] blur-sm"
          />
        )}

        <CardContent className="relative p-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{formatFR(match.kickoff_at)}</span>
            {!showFinalScore && <LiveCountdown kickoff={match.kickoff_at} />}
            {showFinalScore && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                <Trophy className="h-3 w-3" /> Terminé
              </span>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground">
              <Radio className="h-2.5 w-2.5" /> Diffusion
            </span>
            {getChannels(match).map((c) => (
              <ChannelBadge key={c.name} name={c.name} />
            ))}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Team A */}
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-end sm:gap-3 sm:text-right">
              {codeA && (
                <div
                  className="relative shrink-0 sm:order-2"
                  style={{ filter: `drop-shadow(0 0 6px ${palA.primary}66)` }}
                >
                  <img
                    srcSet={flagSrcSet(codeA)}
                    src={`https://flagcdn.com/w80/${codeA}.png`}
                    alt={nameA}
                    className="h-9 w-12 rounded-md object-cover ring-2 transition-transform duration-300 hover:scale-110"
                    style={{ borderColor: palA.primary, boxShadow: `0 0 0 1px ${palA.primary}` }}
                  />
                </div>
              )}
              <span className="min-w-0 break-words text-xs font-bold uppercase tracking-wide leading-tight sm:order-1 sm:truncate sm:text-sm">{nameA}</span>
            </div>

            {/* Score zone */}
            <div className="flex items-center gap-2">
              {showFinalScore ? (
                <div className="flex items-center gap-1 rounded-lg border-2 border-amber-500/40 bg-gradient-to-b from-[#0a0a0f] to-[#15151c] px-3 py-1.5 font-mono text-2xl font-black tabular-nums shadow-inner" style={{ color: "#FFD100", textShadow: "0 0 8px #FFD10088" }}>
                  {match.score_a}<span className="text-muted-foreground/60">:</span>{match.score_b}
                </div>
              ) : (
                <>
                  <ScoreStepper value={scoreA} onChange={setScoreA} disabled={!canPredict || locked || busy} color={palA.primary} />
                  <span className="text-lg font-bold text-muted-foreground/40">:</span>
                  <ScoreStepper value={scoreB} onChange={setScoreB} disabled={!canPredict || locked || busy} color={palB.primary} />
                </>
              )}
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
              {codeB && (
                <div
                  className="relative shrink-0"
                  style={{ filter: `drop-shadow(0 0 6px ${palB.primary}66)` }}
                >
                  <img
                    srcSet={flagSrcSet(codeB)}
                    src={`https://flagcdn.com/w80/${codeB}.png`}
                    alt={nameB}
                    className="h-9 w-12 rounded-md object-cover ring-2 transition-transform duration-300 hover:scale-110"
                    style={{ borderColor: palB.primary, boxShadow: `0 0 0 1px ${palB.primary}` }}
                  />
                </div>
              )}
              <span className="min-w-0 break-words text-xs font-bold uppercase tracking-wide leading-tight sm:truncate sm:text-sm">{nameB}</span>
            </div>
          </div>

          {match.finished && prediction && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-center text-sm shadow-sm backdrop-blur"
            >
              <span className="text-xs text-muted-foreground">Votre prono</span>
              <span className="font-mono font-black tabular-nums">{prediction.score_a} – {prediction.score_b}</span>
              <Badge variant={prediction.points >= 3 ? "default" : prediction.points > 0 ? "secondary" : "outline"} className="font-bold">
                {prediction.points > 0 && "+"}{prediction.points} pt{prediction.points > 1 ? "s" : ""}
              </Badge>
            </motion.div>
          )}

          {/* SECTION STATISTIQUES DES PRONOSTICS */}
          {stats && stats.total > 0 && (
            <div className="mt-4 rounded-lg bg-background/40 p-3 ring-1 ring-border/50">
              <div className="mb-1.5 flex justify-between text-[10px] font-bold tracking-wider">
                <span style={{ color: palA.primary }}>{Math.round((stats.a / stats.total) * 100)}%</span>
                <span className="text-muted-foreground">{Math.round((stats.draw / stats.total) * 100)}% NUL</span>
                <span style={{ color: palB.primary }}>{Math.round((stats.b / stats.total) * 100)}%</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted opacity-80">
                <div style={{ width: `${(stats.a / stats.total) * 100}%`, backgroundColor: palA.primary }} />
                <div style={{ width: `${(stats.draw / stats.total) * 100}%`, backgroundColor: '#64748b' }} />
                <div style={{ width: `${(stats.b / stats.total) * 100}%`, backgroundColor: palB.primary }} />
              </div>
              <div className="mt-2 flex items-center justify-center gap-1 text-[9px] text-muted-foreground uppercase">
                <Users className="h-3 w-3" />
                Basé sur {stats.total} pronostic{stats.total > 1 ? "s" : ""}
              </div>
            </div>
          )}

          {((match.goalscorers && match.goalscorers.length > 0) || match.stadium) && (
            <div className="mt-3 rounded-lg border bg-card/40 p-2.5 text-xs backdrop-blur-sm">
              {match.stadium && (
                <div className="mb-2 flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{match.stadium}</span>
                </div>
              )}
              {match.goalscorers && match.goalscorers.length > 0 && (
                <>
                  <div className="mb-1 flex items-center gap-1 font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>⚽</span> Buteurs
                  </div>
                  {match.team_a?.name && match.team_b?.name && (
                    <GoalTimeline goals={match.goalscorers} teamA={match.team_a.name} teamB={match.team_b.name} />
                  )}
                  <ul className="mt-2 space-y-0.5">
                    {match.goalscorers.map((g, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          <span className="font-medium">{g.player}</span>
                          {g.type === "own" && <span className="ml-1 text-destructive">(c.s.c.)</span>}
                          {g.type === "penalty" && <span className="ml-1 text-muted-foreground">(p.)</span>}
                          <span className="ml-1 text-muted-foreground">· {g.team}</span>
                        </span>
                        {g.minute != null && (
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {g.minute}{g.extra ? `+${g.extra}` : ""}'
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            {locked ? (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <Lock className="h-3 w-3" />
                {match.finished ? "Match terminé" : lockMessage(match.kickoff_at)}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" /> {timeUntilLock(match.kickoff_at)}
              </span>
            )}
            {canPredict && !locked && (
              <Button3D
                size="sm"
                variant={prediction ? "primary" : "gold"}
                onClick={save}
                disabled={busy}
                leftIcon={<span className="text-base leading-none">⚽</span>}
              >
                {prediction ? "Modifier" : "Pronostiquer"}
              </Button3D>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}