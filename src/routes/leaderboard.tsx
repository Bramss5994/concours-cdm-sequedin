import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({ component: Leaderboard });

const STAGES = [
  { value: "all", label: "Général" },
  { value: "group", label: "Groupes" },
  { value: "r32", label: "32es" },
  { value: "r16", label: "8es" },
  { value: "qf", label: "Quarts" },
  { value: "sf", label: "Demis" },
  { value: "final", label: "Finale" },
];

function Leaderboard() {
  const [stage, setStage] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard-data"],
    queryFn: async () => {
      const [{ data: profiles }, { data: predictions }, { data: matches }] = await Promise.all([
        supabase.from("profiles").select("id, prenom, nom, active"),
        supabase.from("predictions").select("user_id, match_id, points, exact_score, good_winner"),
        supabase.from("matches").select("id, stage, finished"),
      ]);
      return { profiles: profiles || [], predictions: predictions || [], matches: matches || [] };
    },
  });

  const board = useMemo(() => {
    if (!("profiles" in rows)) return [];
    const r = rows as any;
    const matchById = new Map(r.matches.map((m: any) => [m.id, m]));
    const stats = new Map<string, { user_id: string; name: string; pts: number; exact: number; good: number; }>();
    for (const p of r.profiles) {
      if (p.active === false) continue;
      stats.set(p.id, { user_id: p.id, name: `${p.prenom} ${p.nom}`.trim() || "Anonyme", pts: 0, exact: 0, good: 0 });
    }
    for (const pred of r.predictions) {
      const m = matchById.get(pred.match_id);
      if (!m || !m.finished) continue;
      if (stage !== "all" && m.stage !== stage) continue;
      const s = stats.get(pred.user_id);
      if (!s) continue;
      s.pts += pred.points || 0;
      if (pred.exact_score) s.exact++;
      if (pred.good_winner) s.good++;
    }
    return [...stats.values()].sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.good - a.good);
  }, [rows, stage]);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Classement</h1>
      <p className="mt-1 text-sm text-muted-foreground">Dépôt de Sequedin · mis à jour après chaque match.</p>

      <Tabs value={stage} onValueChange={setStage} className="mt-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {STAGES.map((s) => <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement...</p>
          ) : board.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun participant pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Participant</th>
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-right">Scores exacts</th>
                    <th className="px-3 py-2 text-right">Bons vainqueurs</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((r, i) => (
                    <tr key={r.user_id} className="border-t">
                      <td className="px-3 py-2 font-bold">
                        {i === 0 ? <Trophy className="inline h-4 w-4 text-yellow-500" /> : i < 3 ? <Medal className="inline h-4 w-4 text-muted-foreground" /> : null} {i + 1}
                      </td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-right font-bold">{r.pts}</td>
                      <td className="px-3 py-2 text-right">{r.exact}</td>
                      <td className="px-3 py-2 text-right">{r.good}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
