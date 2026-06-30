import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isLocked, formatFR, timeUntilLock } from "@/lib/time";
import { toast } from "sonner";
import { Trophy, Lock, Radio } from "lucide-react";
import { flagUrl, flagSrcSet } from "@/lib/flag";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

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
        {m.team_a?.code && <img src={flagUrl(m.team_a.code, 24)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
      </div>
      <div className="px-2 flex items-center">
        <FinalScore m={m} />
        <ExtraTimeBadge m={m} />
      </div>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {m.team_b?.code && <img src={flagUrl(m.team_b.code, 24)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
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
        {m.team_a?.code && <img src={flagUrl(m.team_a.code, 24)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
      </div>
      <div className="font-mono font-bold tabular-nums">{a ?? 0}-{b ?? 0}</div>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {m.team_b?.code && <img src={flagUrl(m.team_b.code, 24)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
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

  const stagesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) set.add(m.stage || "group");
    return STAGE_ORDER.filter((s) => set.has(s));
  }, [matches]);

  if (isLoading) {
    return <div className="container mx-auto py-12 text-center text-muted-foreground">Chargement des matchs…</div>;
  }

  return (
    <div className="container mx-auto py-6 px-3 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-primary h-8 w-8" />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Pronos Coupe du Monde 2026</h1>
      </div>

      {liveMatches.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-600" /> En direct
          </h2>
          <div className="grid gap-2">
            {liveMatches.map((m) => <LiveRow key={m.id} m={m} />)}
          </div>
        </section>
      )}

      <Tabs defaultValue={stagesPresent[stagesPresent.length - 1] || "group"}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {stagesPresent.map((s) => (
            <TabsTrigger key={s} value={s}>{STAGE_LABELS[s] || s}</TabsTrigger>
          ))}
        </TabsList>

        {stagesPresent.map((stage) => {
          const stageMatches = matches
            .filter((m) => (m.stage || "group") === stage)
            .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

          // Split: upcoming (predictable or locked-not-finished) vs finished
          const upcoming = stageMatches.filter((m) => !m.finished);
          const finished = stageMatches.filter((m) => m.finished);

          // Group upcoming by group letter if group stage
          if (stage === "group") {
            const byGroup: Record<string, Match[]> = {};
            for (const m of upcoming) {
              const g = m.group_letter || "?";
              (byGroup[g] ||= []).push(m);
            }
            const finByGroup: Record<string, Match[]> = {};
            for (const m of finished) {
              const g = m.group_letter || "?";
              (finByGroup[g] ||= []).push(m);
            }
            const letters = Array.from(new Set([...Object.keys(byGroup), ...Object.keys(finByGroup)])).sort();

            return (
              <TabsContent key={stage} value={stage} className="space-y-6 mt-4">
                {letters.map((g) => (
                  <section key={g}>
                    <h3 className="text-lg font-bold mb-2">Groupe {g}</h3>
                    {(byGroup[g] || []).length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2 mb-3">
                        {(byGroup[g] || []).map((m) => (
                          <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
                        ))}
                      </div>
                    )}
                    {(finByGroup[g] || []).length > 0 && (
                      <div className="space-y-2">
                        {(finByGroup[g] || []).map((m) => <ResultRow key={m.id} m={m} />)}
                      </div>
                    )}
                  </section>
                ))}
              </TabsContent>
            );
          }

          return (
            <TabsContent key={stage} value={stage} className="space-y-4 mt-4">
              {upcoming.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((m) => (
                    <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
                  ))}
                </div>
              )}
              {finished.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground mt-4">Résultats</h3>
                  {finished.map((m) => <ResultRow key={m.id} m={m} />)}
                </div>
              )}
              {upcoming.length === 0 && finished.length === 0 && (
                <div className="text-center text-muted-foreground py-8">Aucun match.</div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
