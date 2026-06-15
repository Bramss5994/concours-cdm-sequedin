import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, CheckCircle2, Radio, Tv, Trophy, Users } from "lucide-react";
import { flagSrcSet } from "@/lib/flag";
import { formatFR, isLocked, lockMessage, timeUntilLock } from "@/lib/time";
import { teamPalette } from "@/lib/team-colors";
import { getChannels } from "@/lib/broadcast";

// --- Types et Composants auxiliaires restent identiques à votre version originale ---
// [Note: J'ai conservé votre structure de base, copiez tout le bloc ci-dessous]

export const Route = createFileRoute("/matches")({ component: MatchesPage });

function MatchCard({ match, prediction, canPredict }: { match: any; prediction?: any; canPredict: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data && data.length > 0) setStats(data[0]);
    };
    fetchStats();
  }, [match.id]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("predictions")
      .upsert({ user_id: user.id, match_id: match.id, score_a: Number(scoreA), score_b: Number(scoreB) }, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (!error) {
      toast.success("Pronostic enregistré");
      qc.invalidateQueries({ queryKey: ["predictions"] });
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data) setStats(data[0]);
    }
  }

  const palA = teamPalette(match.team_a?.code);
  const palB = teamPalette(match.team_b?.code);
  const locked = isLocked(match.kickoff_at);

  return (
    <Card className="p-4 shadow-md ring-1 ring-border">
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold">{match.team_a?.name || "..."} vs {match.team_b?.name || "..."}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
         <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center" />
         <span>-</span>
         <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center" />
         <Button onClick={save} disabled={locked || busy}>OK</Button>
      </div>

      {/* SECTION STATISTIQUES SÉCURISÉE */}
      {stats && stats.total_votes > 0 && (
        <div className="mt-4 rounded-lg bg-muted/20 p-3">
          <div className="flex justify-between text-[10px] font-bold mb-1">
            <span style={{ color: palA.primary }}>{stats.perc_a}%</span>
            <span className="text-muted-foreground">{stats.perc_draw}% NUL</span>
            <span style={{ color: palB.primary }}>{stats.perc_b}%</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            <div style={{ width: `${stats.perc_a}%`, backgroundColor: palA.primary }} />
            <div style={{ width: `${stats.perc_draw}%`, backgroundColor: '#64748b' }} />
            <div style={{ width: `${stats.perc_b}%`, backgroundColor: palB.primary }} />
          </div>
          <p className="mt-1 text-center text-[9px] text-muted-foreground flex items-center justify-center gap-1">
            <Users size={10} /> {stats.total_votes} votes
          </p>
        </div>
      )}
    </Card>
  );
}

function MatchesPage() {
  // Gardez votre logique de rendu MatchesPage ici
  return <div>Chargement des matchs...</div>; 
}