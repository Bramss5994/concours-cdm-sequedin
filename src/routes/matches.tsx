import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isLocked } from "@/lib/time";
import { toast } from "sonner";

export const Route = createFileRoute("/matches")({ component: MatchesPage });

// --- Types ---
type Match = { id: string; stage: string; kickoff_at: string; team_a: any; team_b: any; finished: boolean; score_a: number | null; score_b: number | null };
type Prediction = { match_id: string; score_a: number; score_b: number };

function MatchCard({ match, prediction, canPredict }: { match: Match; prediction?: Prediction; canPredict: boolean }) {
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
    }
  }

  const locked = isLocked(match.kickoff_at);

  return (
    <Card className="p-4 border shadow-sm bg-card">
      <div className="flex justify-between items-center mb-4 text-foreground">
        <span className="font-bold">{match.team_a?.name || "..."} vs {match.team_b?.name || "..."}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
         <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center text-white bg-black" />
         <span className="text-white">-</span>
         <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center text-white bg-black" />
         <Button onClick={save} disabled={locked || busy}>OK</Button>
      </div>

      {stats && stats.total_votes > 0 && (
        <div className="mt-4 text-center">
          <p className="text-white text-sm font-bold">{stats.total_votes} pronostics enregistrés</p>
        </div>
      )}
    </Card>
  );
}

function MatchesPage() {
  const { user } = useAuth();
  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: async () => { const { data } = await supabase.from("matches").select("*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*)"); return data as Match[]; } });
  const { data: predictions = [] } = useQuery({ queryKey: ["predictions", user?.id], enabled: !!user, queryFn: async () => { const { data } = await supabase.from("predictions").select("*").eq("user_id", user!.id); return data as Prediction[]; } });

  const predByMatch = useMemo(() => Object.fromEntries(predictions.map((p) => [p.match_id, p])), [predictions]);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Coupe du Monde 2026</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} prediction={predByMatch[m.id]} canPredict={!!user} />
        ))}
      </div>
    </div>
  );
}