import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trophy, Medal } from "lucide-react";
import { getUnitAdminSession, getUnitLeaderboardFn } from "@/lib/unit-admin.functions";

export const Route = createFileRoute("/unite/classement")({
  component: UniteClassementPage,
  head: () => ({ meta: [{ title: "Classement — Admin d'unité" }] }),
});

const STAGES = [
  { value: "all", label: "Général" },
  { value: "group", label: "Phase de groupes" },
  { value: "r32", label: "16es" },
  { value: "r16", label: "8es" },
  { value: "qf", label: "Quarts" },
  { value: "sf", label: "Demis" },
  { value: "final", label: "Finale" },
];

const DEPOTS = [
  { value: "all", label: "Toutes les unités" },
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
  { value: "tram", label: "Tram" },
  { value: "copem", label: "COPEM" },
  { value: "support", label: "Équipe Support" },
];
const DEPOT_LABEL: Record<string, string> = {
  sequedin: "Sequedin", faidherbe: "Faidherbe", wattrelos: "Wattrelos",
  pc_bus: "PC Bus", tram: "Tram", copem: "COPEM", support: "Équipe Support",
};

function UniteClassementPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getUnitAdminSession);
  const fetchBoard = useServerFn(getUnitLeaderboardFn);

  const sessionQ = useQuery({
    queryKey: ["unit-admin-session"],
    queryFn: () => fetchSession(),
  });

  useEffect(() => {
    if (sessionQ.isFetched && !sessionQ.data) {
      navigate({ to: "/unite/login", replace: true });
    }
  }, [sessionQ.isFetched, sessionQ.data, navigate]);

  const dataQ = useQuery({
    queryKey: ["unit-admin-leaderboard"],
    queryFn: () => fetchBoard(),
    enabled: !!sessionQ.data,
  });

  const isSuper = (sessionQ.data as any)?.isSuper;
  const myDepot = sessionQ.data?.depot ?? "all";
  const [stage, setStage] = useState("all");
  const [depotFilter, setDepotFilter] = useState<string>(isSuper ? "all" : myDepot);

  useEffect(() => {
    if (!isSuper && myDepot) setDepotFilter(myDepot);
  }, [isSuper, myDepot]);

  const board = useMemo(() => {
    if (!dataQ.data) return [];
    const matchById = new Map<string, any>(dataQ.data.matches.map((m: any) => [m.id, m]));
    const bonusById = new Map<string, number>(((dataQ.data as any).bonuses || []).map((b: any) => [b.user_id, b.bonus || 0]));
    const scorerBonusById = new Map<string, number>(((dataQ.data as any).scorerBonuses || []).map((b: any) => [b.user_id, b.bonus || 0]));
    const stats = new Map<string, { user_id: string; name: string; depot: string; pts: number; exact: number; good: number; bonus: number; groupPts: number; koPts: number; finalPts: number; }>();
    for (const p of dataQ.data.profiles as any[]) {
      if (p.active === false) continue;
      if (depotFilter !== "all" && p.depot !== depotFilter) continue;
      const bonus = stage === "all" ? (bonusById.get(p.id) || 0) + (scorerBonusById.get(p.id) || 0) : 0;
      stats.set(p.id, { user_id: p.id, name: `${p.prenom ?? ""} ${p.num_paie ?? ""}`.trim() || "Anonyme", depot: p.depot || "sequedin", pts: bonus, exact: 0, good: 0, bonus, groupPts: 0, koPts: 0, finalPts: 0 });
    }
    for (const pred of dataQ.data.predictions as any[]) {
      const m = matchById.get(pred.match_id);
      if (!m || !m.finished) continue;
      if (stage !== "all" && m.stage !== stage) continue;
      const s = stats.get(pred.user_id);
      if (!s) continue;
      const pts = pred.points || 0;
      s.pts += pts;
      if (m.stage === "group") s.groupPts += pts;
      else if (m.stage === "final") s.finalPts += pts;
      else s.koPts += pts;
      if (pred.exact_score) s.exact++;
      if (pred.good_winner) s.good++;
    }
    return [...stats.values()].sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.good - a.good);
  }, [dataQ.data, stage, depotFilter]);

  if (!sessionQ.data) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Vérification…</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Classement</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSuper ? "Toutes les unités" : `Unité ${DEPOT_LABEL[myDepot] ?? myDepot}`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/unite"><ArrowLeft className="mr-1 h-4 w-4" /> Retour au panel</Link>
        </Button>
      </div>

      {isSuper && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">Filtrer par unité</span>
          <Select value={depotFilter} onValueChange={setDepotFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={stage} onValueChange={setStage} className="mt-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {STAGES.map((s) => <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card className="mt-4">
        <CardContent className="p-0">
          {dataQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : board.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun participant pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Participant</th>
                    {isSuper && <th className="px-3 py-2 text-left">Unité</th>}
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-right">Scores exacts</th>
                    <th className="px-3 py-2 text-right">Bons vainqueurs</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((r, i) => (
                    <tr key={r.user_id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 font-bold">
                        {i === 0 ? <Trophy className="inline h-4 w-4 text-yellow-500" /> : i < 3 ? <Medal className="inline h-4 w-4 text-muted-foreground" /> : null} {i + 1}
                      </td>
                      <td className="px-3 py-2">{r.name}</td>
                      {isSuper && <td className="px-3 py-2"><Badge variant="secondary">{DEPOT_LABEL[r.depot] || r.depot}</Badge></td>}
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
