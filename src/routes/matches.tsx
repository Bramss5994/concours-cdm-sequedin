import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isLocked } from "@/lib/time";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/matches")({ component: MatchesPage });

// Types étendus pour inclure vos données (flag, stadium, etc.)
type Match = { 
  id: string; 
  kickoff_at: string; 
  stadium: string;
  team_a: { name: string; flag: string }; 
  team_b: { name: string; flag: string }; 
  finished: boolean; 
  score_a: number | null; 
  score_b: number | null 
};

type Prediction = { match_id: string; score_a: number; score_b: number };

function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  const time = new Date(match.kickoff_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const locked = isLocked(match.kickoff_at);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("predictions")
      .upsert({ user_id: user.id, match_id: match.id, score_a: Number(scoreA), score_b: Number(scoreB) }, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (!error) {
      toast.success("Pronostic enregistré");
      qc.invalidateQueries({ queryKey: ["predictions"] });
    } else {
      toast.error("Erreur lors de l'enregistrement");
    }
  }

  return (
    <Card className="p-4 border shadow-sm bg-card">
      <div className="flex justify-between text-xs text-muted-foreground mb-3">
        <span>{time}</span>
        <span className="truncate ml-2">{match.stadium || "Stade à déterminer"}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <span className="text-xl">{match.team_a?.flag}</span>
           <span className="font-bold">{match.team_a?.name || "..."}</span>
        </div>
        <span className="text-muted-foreground mx-2">vs</span>
        <div className="flex items-center gap-2">
           <span className="font-bold">{match.team_b?.name || "..."}</span>
           <span className="text-xl">{match.team_b?.flag}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
         <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center text-white bg-black font-bold" />
         <span className="text-white font-bold">-</span>
         <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center text-white bg-black font-bold" />
         <Button onClick={save} disabled={locked || busy || (!scoreA && !scoreB)}>
            {busy ? <Loader2 className="animate-spin h-4 w-4" /> : "OK"}
         </Button>
      </div>
    </Card>
  );
}

function MatchesPage() {
  const { user } = useAuth();
  
  const { data: matches = [], isLoading: loadingMatches } = useQuery({ 
    queryKey: ["matches"], 
    queryFn: async () => { 
      const { data } = await supabase.from("matches").select("*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*)"); 
      return data as Match[]; 
    } 
  });

  const { data: predictions = [] } = useQuery({ 
    queryKey: ["predictions", user?.id], 
    enabled: !!user, 
    queryFn: async () => { 
      const { data } = await supabase.from("predictions").select("*").eq("user_id", user!.id); 
      return data as Prediction[]; 
    } 
  });

  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]));

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Coupe du Monde 2026 - Pronos Sequedin</h1>
      {loadingMatches ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
          ))}
        </div>
      )}
    </div>
  );
}