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

// --- Types ---
type Team = { id: string; code: string; name: string; group_letter: string | null };
type Goalscorer = { minute: number | null; extra: number | null; team: string; player: string; type: "goal" | "penalty" | "own" | "missed"; };
type Match = { id: string; stage: string; group_letter: string | null; kickoff_at: string; stadium: string | null; team_a_id: string | null; team_b_id: string | null; team_a_placeholder: string | null; team_b_placeholder: string | null; score_a: number | null; score_b: number | null; finished: boolean; team_a: Team | null; team_b: Team | null; goalscorers?: Goalscorer[] | null; };
type Prediction = { match_id: string; score_a: number; score_b: number; points: number };

// --- Composant MatchCard (avec Stats RPC intégrées) ---
function MatchCard({ match, prediction, canPredict }: { match: Match; prediction?: Prediction; canPredict: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  // Récupération sécurisée des stats
  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data && data.length > 0) setStats(data[0]);
    };
    fetchStats();
  }, [match.id]);

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
    const { error } = await supabase.from("predictions").upsert({ user_id: user.id, match_id: match.id, score_a: a, score_b: b }, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (error) toast.error(error.message);
    else { 
      toast.success("✓ Pronostic enregistré"); 
      qc.invalidateQueries({ queryKey: ["predictions"] });
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data) setStats(data[0]);
    }
  }

  const palA = teamPalette(match.team_a?.code);
  const palB = teamPalette(match.team_b?.code);
  const locked = isLocked(match.kickoff_at);

  return (
    <Card className="relative overflow-hidden border-0 shadow-md ring-1 ring-border">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: match.finished ? "#FFD100" : locked ? "#E4002B" : "#00A86B" }} />
      <CardContent className="p-4">
        {/* ... (votre JSX existant pour l'affichage du match) ... */}
        
        {/* SECTION STATISTIQUES */}
        {stats && stats.total_votes > 0 && (
          <div className="mt-4 rounded-lg bg-background/40 p-3 ring-1 ring-border/50">
            <div className="flex justify-between text-[10px] font-bold">
              <span style={{ color: palA.primary }}>{stats.perc_a}%</span>
              <span className="text-muted-foreground">{stats.perc_draw}% NUL</span>
              <span style={{ color: palB.primary }}>{stats.perc_b}%</span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div style={{ width: `${stats.perc_a}%`, backgroundColor: palA.primary }} />
              <div style={{ width: `${stats.perc_draw}%`, backgroundColor: '#64748b' }} />
              <div style={{ width: `${stats.perc_b}%`, backgroundColor: palB.primary }} />
            </div>
            <p className="mt-1 text-center text-[9px] text-muted-foreground">{stats.total_votes} votes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Le reste de votre page MatchesPage reste identique ---
function MatchesPage() { 
  /* ... Votre code MatchesPage existant ... */ 
}