import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isLocked } from "@/lib/time";
import { toast } from "sonner";
import { Loader2, Trophy, BarChart3 } from "lucide-react";
import { flagUrl, flagSrcSet } from "@/lib/flag";

export const Route = createFileRoute("/matches")({ component: MatchesPage });

// Types complets incluant vos données enrichies
type Match = { 
  id: string; 
  kickoff_at: string; 
  stadium: string;
  api_fixture_id?: number | null;
  team_a: { name: string; code?: string } | null; 
  team_b: { name: string; code?: string } | null; 
  finished: boolean; 
  score_a: number | null; 
  score_b: number | null;
  goalscorers?: Array<{
    minute: number | null;
    extra: number | null;
    team: string;
    player: string;
    api_player_id?: number | null;
    assist?: string | null;
    type?: string;
  }> | null;
};

type Prediction = { match_id: string; score_a: number; score_b: number };

function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data && data.length > 0) setStats(data[0]);
    };
    fetchStats();
  }, [match.id]);

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
    }
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border-primary/20 bg-card p-4">
      {/* Effet visuel lumineux */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex justify-between text-xs text-muted-foreground mb-4">
        <span>{new Date(match.kickoff_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span>{match.stadium}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col items-center gap-2">
          {match.team_a?.code ? (
            <img src={flagUrl(match.team_a.code, 40)} srcSet={flagSrcSet(match.team_a.code)} alt={match.team_a?.name || ''} className="h-8 w-12 rounded-sm object-cover" />
          ) : (
            <span className="text-3xl">{match.team_a?.name?.charAt(0) ?? "?"}</span>
          )}
          <span className="font-bold text-sm">{match.team_a?.name}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 size={12}/> Stats</span>
            <div className="flex w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${stats?.percentage_a || 50}%` }} />
                <div className="bg-accent h-full" style={{ width: `${stats?.percentage_b || 50}%` }} />
            </div>
        </div>
        <div className="flex flex-col items-center gap-2">
           <span className="text-3xl">{match.team_b?.flag}</span>
           <span className="font-bold text-sm">{match.team_b?.name}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
         <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={locked || busy} className="w-14 p-2 border rounded-lg text-center font-bold text-lg bg-background" />
         <span className="font-bold"> - </span>
         <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={locked || busy} className="w-14 p-2 border rounded-lg text-center font-bold text-lg bg-background" />
         <Button onClick={save} disabled={locked || busy} className="ml-2">OK</Button>
      </div>
    </Card>
  );
}

function MatchesPage() {
  const { user } = useAuth();
  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: async () => { const { data } = await supabase.from("matches").select("*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*)"); return data as Match[]; } });
  const { data: predictions = [] } = useQuery({ queryKey: ["predictions", user?.id], enabled: !!user, queryFn: async () => { const { data } = await supabase.from("predictions").select("*").eq("user_id", user!.id); return data as Prediction[]; } });

  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]));

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="text-primary h-8 w-8" />
        <h1 className="text-3xl font-extrabold tracking-tight">Pronos Sequedin 2026</h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
        ))}
      </div>
    </div>
  );
}