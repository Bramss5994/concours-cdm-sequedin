import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, CheckCircle2, MapPin, Trophy, Radio } from "lucide-react";
import { flagSrcSet } from "@/lib/flag";
import { formatFR, isLocked, lockMessage, timeUntilLock } from "@/lib/time";
import { getChannels } from "@/lib/broadcast";
import { useLiveScores, kickoffKeyFromISO, type LiveFixture } from "@/hooks/use-live-scores";
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
            {isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p>
              : <CalendarView matches={matches} predByMatch={predByMatch} canPredict={!!user} />}
          </TabsContent>

          <TabsContent value="group" className="mt-4">
            {isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p>
              : <GroupedMatches matches={matches.filter(m => m.stage === "group")} predByMatch={predByMatch} canPredict={!!user} />}
          </TabsContent>

          <TabsContent value="ko" className="mt-4 space-y-8">
            {isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p>
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
                    <MatchList matches={list} predByMatch={predByMatch} canPredict={!!user} />
                  </motion.section>
                );
              })}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function CalendarView({ matches, predByMatch, canPredict }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean }) {
  const byDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const key = new Date(m.kickoff_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  return (
    <div className="space-y-6">
      {byDate.map(([day, list]) => {
        const label = new Date(day + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        return (
          <motion.section
            key={day}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">{label}</h3>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={staggerContainer}
              className="grid gap-3 md:grid-cols-2"
            >
              {list.map((m, i) => (
                <motion.div key={m.id} variants={fadeUp} custom={i}>
                  <MatchCard match={m} prediction={predByMatch[m.id]} canPredict={canPredict} />
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        );
      })}
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
                <MatchCard match={m} prediction={predByMatch[m.id]} canPredict={canPredict} />
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

function MatchList({ matches, predByMatch, canPredict }: { matches: Match[]; predByMatch: Record<string, Prediction>; canPredict: boolean }) {
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
          <MatchCard match={m} prediction={predByMatch[m.id]} canPredict={canPredict} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function MatchCard({ match, prediction, canPredict }: { match: Match; prediction?: Prediction; canPredict: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { byKickoff } = useLiveScores();
  const live: LiveFixture | undefined = byKickoff[kickoffKeyFromISO(match.kickoff_at)];
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
    <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-md">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">{formatFR(match.kickoff_at)}</span>
          {match.stadium && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{match.stadium}</span>}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Diffusion</span>
          {getChannels(match).map((c) => (
            <span key={c.name} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${c.color}`}>{c.name}</span>
          ))}
        </div>


        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 justify-end text-right">
            <span className="font-semibold truncate">{nameA}</span>
            {codeA && <img srcSet={flagSrcSet(codeA)} src={`https://flagcdn.com/w40/${codeA}.png`} alt={nameA} className="flag-wave h-6 w-8 rounded-sm object-cover ring-1 ring-border" />}
          </div>
          <div className="flex items-center gap-1">
            <Input type="number" min={0} max={20} value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={!canPredict || locked || busy} className="h-9 w-12 text-center font-bold" />
            <span className="text-muted-foreground">-</span>
            <Input type="number" min={0} max={20} value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={!canPredict || locked || busy} className="h-9 w-12 text-center font-bold" />
          </div>
          <div className="flex items-center gap-2">
            {codeB && <img srcSet={flagSrcSet(codeB)} src={`https://flagcdn.com/w40/${codeB}.png`} alt={nameB} className="flag-wave h-6 w-8 rounded-sm object-cover ring-1 ring-border" />}
            <span className="font-semibold truncate">{nameB}</span>
          </div>
        </div>

        {live && live.isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-3 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-destructive">
              <Radio className="h-3 w-3 animate-pulse" /> Live
              {live.elapsed != null && <span className="font-mono">{live.elapsed}'</span>}
              <span className="font-normal normal-case text-muted-foreground">· {live.statusLabel}</span>
            </span>
            <span className="font-bold tabular-nums">
              {live.scoreHome != null && live.scoreAway != null
                ? `${live.scoreHome} - ${live.scoreAway}`
                : "Score en cours"}
            </span>
          </motion.div>
        )}

        {match.finished && match.score_a != null && match.score_b != null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-3 rounded-md bg-muted px-3 py-1.5 text-center text-sm"
          >
            <span className="text-muted-foreground">Résultat officiel : </span>
            <span className="font-bold">{match.score_a} - {match.score_b}</span>
            {prediction && (
              <Badge variant={prediction.points >= 3 ? "default" : prediction.points > 0 ? "secondary" : "outline"} className="ml-2">
                {prediction.points} pt{prediction.points > 1 ? "s" : ""}
              </Badge>
            )}
          </motion.div>
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
