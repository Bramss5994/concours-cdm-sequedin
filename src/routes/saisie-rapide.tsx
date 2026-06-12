import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Lock, CheckCircle2, Save, Zap, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { flagSrcSet } from "@/lib/flag";
import { isLocked, timeUntilLock, formatFR } from "@/lib/time";

export const Route = createFileRoute("/saisie-rapide")({
  head: () => ({
    meta: [
      { title: "Saisie rapide — Pronostics CDM 2026" },
      { name: "description", content: "Saisis tous tes pronostics du jour en un seul écran." },
    ],
  }),
  component: QuickEntryPage,
});

type Team = { id: string; code: string; name: string };
type Match = {
  id: string;
  kickoff_at: string;
  stadium: string | null;
  stage: string;
  group_letter: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_placeholder: string | null;
  team_b_placeholder: string | null;
  team_a: Team | null;
  team_b: Team | null;
  finished: boolean;
  score_a: number | null;
  score_b: number | null;
};
type Prediction = { match_id: string; score_a: number; score_b: number };

function parisKey(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}

function todayParisKey() {
  return parisKey(new Date().toISOString());
}

function shiftDayKey(key: string, delta: number) {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return parisKey(d.toISOString());
}

function formatDay(key: string) {
  return new Date(key + "T12:00:00Z").toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function QuickEntryPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [dayKey, setDayKey] = useState<string>(todayParisKey());

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "*, team_a:teams!matches_team_a_id_fkey(id,code,name), team_b:teams!matches_team_b_id_fkey(id,code,name)",
        )
        .order("kickoff_at");
      if (error) throw error;
      return data as unknown as Match[];
    },
    refetchInterval: 5 * 60_000,
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("match_id, score_a, score_b")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as Prediction[];
    },
  });

  const dayMatches = useMemo(
    () => matches.filter((m) => parisKey(m.kickoff_at) === dayKey),
    [matches, dayKey],
  );

  // Jour le plus proche avec des matchs (pour les jours vides)
  const closestDayWithMatches = useMemo(() => {
    if (dayMatches.length || matches.length === 0) return null;
    const today = todayParisKey();
    const futureKeys = [...new Set(matches.map((m) => parisKey(m.kickoff_at)))]
      .filter((k) => k >= today)
      .sort();
    return futureKeys[0] ?? null;
  }, [matches, dayMatches, dayKey]);

  const predByMatch = useMemo(
    () => Object.fromEntries(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  if (loading) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Zap className="h-7 w-7 text-amber-500" />
          Saisie rapide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tous les matchs du jour, un seul écran, une seule sauvegarde.
        </p>
      </motion.div>

      {!user && (
        <Card className="mt-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm">Connectez-vous pour pronostiquer.</p>
            <Button asChild size="sm">
              <Link to="/auth">Se connecter</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sélecteur de jour */}
      <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border bg-card px-2 py-2 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDayKey((d) => shiftDayKey(d, -1))}
          aria-label="Jour précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 flex-col items-center">
          <div className="flex items-center gap-2 text-sm font-semibold capitalize">
            <Calendar className="h-4 w-4 text-primary" />
            {formatDay(dayKey)}
          </div>
          {dayKey !== todayParisKey() && (
            <button
              className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              onClick={() => setDayKey(todayParisKey())}
            >
              Aujourd'hui
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDayKey((d) => shiftDayKey(d, 1))}
          aria-label="Jour suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement...</p>
      ) : dayMatches.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Aucun match prévu ce jour.</p>
            {closestDayWithMatches && (
              <Button
                variant="link"
                onClick={() => setDayKey(closestDayWithMatches)}
                className="mt-2"
              >
                Aller au prochain jour avec matchs ({formatDay(closestDayWithMatches)})
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <BulkForm
          matches={dayMatches}
          predByMatch={predByMatch}
          canPredict={!!user}
          userId={user?.id ?? null}
          onSaved={() => qc.invalidateQueries({ queryKey: ["predictions"] })}
        />
      )}
    </div>
  );
}

function BulkForm({
  matches,
  predByMatch,
  canPredict,
  userId,
  onSaved,
}: {
  matches: Match[];
  predByMatch: Record<string, Prediction>;
  canPredict: boolean;
  userId: string | null;
  onSaved: () => void;
}) {
  // État local des scores par match (string pour permettre champ vide)
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const [busy, setBusy] = useState(false);

  // Resync quand prédictions / matchs changent
  useEffect(() => {
    const next: Record<string, { a: string; b: string }> = {};
    for (const m of matches) {
      const p = predByMatch[m.id];
      next[m.id] = {
        a: p ? String(p.score_a) : "",
        b: p ? String(p.score_b) : "",
      };
    }
    setScores(next);
  }, [matches.map((m) => m.id).join(","), JSON.stringify(predByMatch)]);

  const editableMatches = matches.filter((m) => !isLocked(m.kickoff_at) && !m.finished);

  // Combien de pronostics modifiés non sauvegardés
  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const m of editableMatches) {
      const cur = scores[m.id];
      if (!cur) continue;
      const p = predByMatch[m.id];
      const a = cur.a.trim();
      const b = cur.b.trim();
      if (a === "" || b === "") continue;
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isInteger(na) || !Number.isInteger(nb)) continue;
      if (!p || p.score_a !== na || p.score_b !== nb) n++;
    }
    return n;
  }, [scores, predByMatch, editableMatches]);

  async function saveAll() {
    if (!userId) return;
    const rows: { user_id: string; match_id: string; score_a: number; score_b: number }[] = [];
    const invalid: string[] = [];
    for (const m of editableMatches) {
      const cur = scores[m.id];
      if (!cur) continue;
      const a = cur.a.trim();
      const b = cur.b.trim();
      if (a === "" && b === "") continue;
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0 || na > 20 || nb > 20) {
        invalid.push(`${m.team_a?.name ?? "?"} - ${m.team_b?.name ?? "?"}`);
        continue;
      }
      const p = predByMatch[m.id];
      if (!p || p.score_a !== na || p.score_b !== nb) {
        rows.push({ user_id: userId, match_id: m.id, score_a: na, score_b: nb });
      }
    }
    if (invalid.length) {
      toast.error(`Scores invalides (0–20) : ${invalid.join(", ")}`);
      return;
    }
    if (rows.length === 0) {
      toast.info("Aucune modification à enregistrer.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("predictions")
      .upsert(rows, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${rows.length} pronostic${rows.length > 1 ? "s" : ""} enregistré${rows.length > 1 ? "s" : ""}`);
      onSaved();
    }
  }

  return (
    <div className="mt-4">
      <div className="space-y-2">
        {matches.map((m, i) => (
          <MatchRow
            key={m.id}
            match={m}
            score={scores[m.id] ?? { a: "", b: "" }}
            saved={predByMatch[m.id]}
            canPredict={canPredict}
            index={i}
            onChange={(a, b) =>
              setScores((prev) => ({ ...prev, [m.id]: { a, b } }))
            }
          />
        ))}
      </div>

      {canPredict && editableMatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-2 mt-4 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="text-xs">
            {dirtyCount > 0 ? (
              <span className="font-semibold text-amber-600">
                {dirtyCount} modification{dirtyCount > 1 ? "s" : ""} à enregistrer
              </span>
            ) : (
              <span className="text-muted-foreground">Aucune modification</span>
            )}
          </div>
          <Button onClick={saveAll} disabled={busy || dirtyCount === 0} size="sm">
            <Save className="h-4 w-4" />
            {busy ? "Enregistrement..." : "Tout enregistrer"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  score,
  saved,
  canPredict,
  index,
  onChange,
}: {
  match: Match;
  score: { a: string; b: string };
  saved?: Prediction;
  canPredict: boolean;
  index: number;
  onChange: (a: string, b: string) => void;
}) {
  const locked = isLocked(match.kickoff_at);
  const finished = match.finished;
  const disabled = !canPredict || locked || finished;
  const nameA = match.team_a?.name || match.team_a_placeholder || "À déterminer";
  const nameB = match.team_b?.name || match.team_b_placeholder || "À déterminer";
  const codeA = match.team_a?.code;
  const codeB = match.team_b?.code;

  const isDirty =
    !disabled &&
    score.a !== "" &&
    score.b !== "" &&
    (!saved || saved.score_a !== Number(score.a) || saved.score_b !== Number(score.b));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card
        className={`overflow-hidden transition-colors ${
          isDirty ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10" : ""
        }`}
      >
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{formatFR(match.kickoff_at)}</span>
            <div className="flex items-center gap-2">
              {locked || finished ? (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Lock className="h-3 w-3" /> {finished ? "Terminé" : "Verrouillé"}
                </Badge>
              ) : (
                <span className="text-amber-600">{timeUntilLock(match.kickoff_at)}</span>
              )}
              {saved && !isDirty && !finished && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex items-center justify-end gap-2 text-right">
              <span className="truncate text-sm font-semibold sm:text-base">{nameA}</span>
              {codeA && (
                <img
                  srcSet={flagSrcSet(codeA)}
                  src={`https://flagcdn.com/w40/${codeA}.png`}
                  alt={nameA}
                  className="h-6 w-9 rounded-sm object-cover ring-1 ring-border"
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              {finished && match.score_a != null && match.score_b != null ? (
                <div className="min-w-16 rounded-md border bg-muted px-3 py-1.5 text-center font-bold tabular-nums">
                  {match.score_a} - {match.score_b}
                </div>
              ) : (
                <>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20}
                    value={score.a}
                    onChange={(e) => onChange(e.target.value, score.b)}
                    disabled={disabled}
                    className="h-10 w-12 text-center text-base font-bold"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20}
                    value={score.b}
                    onChange={(e) => onChange(score.a, e.target.value)}
                    disabled={disabled}
                    className="h-10 w-12 text-center text-base font-bold"
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {codeB && (
                <img
                  srcSet={flagSrcSet(codeB)}
                  src={`https://flagcdn.com/w40/${codeB}.png`}
                  alt={nameB}
                  className="h-6 w-9 rounded-sm object-cover ring-1 ring-border"
                />
              )}
              <span className="truncate text-sm font-semibold sm:text-base">{nameB}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
