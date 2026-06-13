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
    return [...stats.values()].sort((a, b) => b.pts - a.pts || b.good - a.good || b.exact - a.exact);
  }, [dataQ.data, stage, depotFilter]);

  if (!sessionQ.data) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Vérification…</div>;
  }

  const top3 = board.slice(0, 3);
  const rest = board.slice(3);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 shadow-lg shadow-orange-500/30">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <h1 className="truncate bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
              Classement
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isSuper ? "Toutes les unités" : `Unité ${DEPOT_LABEL[myDepot] ?? myDepot}`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/unite"><ArrowLeft className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Retour au panel</span><span className="sm:hidden">Retour</span></Link>
        </Button>
      </div>

      {isSuper && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Unité</span>
          <Select value={depotFilter} onValueChange={setDepotFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={stage} onValueChange={setStage} className="mt-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          {STAGES.map((s) => (
            <TabsTrigger
              key={s.value}
              value={s.value}
              className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md sm:text-sm"
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {dataQ.isLoading ? (
        <Card className="mt-4"><CardContent className="p-6 text-sm text-muted-foreground">Chargement…</CardContent></Card>
      ) : board.length === 0 ? (
        <Card className="mt-4"><CardContent className="p-6 text-sm text-muted-foreground">Aucun participant pour le moment.</CardContent></Card>
      ) : (
        <>
          {/* Podium top 3 */}
          {top3.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {top3.map((r, i) => {
                const styles = [
                  "from-amber-400 via-yellow-500 to-orange-500 shadow-amber-500/40 sm:order-2 sm:scale-105",
                  "from-slate-300 via-slate-400 to-slate-500 shadow-slate-400/40 sm:order-1",
                  "from-orange-400 via-amber-600 to-yellow-700 shadow-orange-600/40 sm:order-3",
                ][i];
                const icon = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                return (
                  <div
                    key={r.user_id}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-xl animate-fade-in ${styles}`}
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="absolute -right-4 -top-4 text-7xl opacity-20">{icon}</div>
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div className="text-3xl">{icon}</div>
                        <div className="text-right">
                          <div className="text-3xl font-black tabular-nums leading-none">{r.pts}</div>
                          <div className="text-[10px] uppercase tracking-wider opacity-80">points</div>
                        </div>
                      </div>
                      <div className="mt-3 truncate text-base font-bold">{r.name}</div>
                      {isSuper && <div className="mt-1 text-xs opacity-90">{DEPOT_LABEL[r.depot] || r.depot}</div>}
                      <div className="mt-2 flex gap-3 text-xs opacity-90">
                        <span>🎯 {r.exact} exact</span>
                        <span>✓ {r.good} bons</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile: cards */}
          <div className="mt-4 space-y-2 md:hidden">
            {rest.map((r, i) => (
              <div
                key={r.user_id}
                className="animate-fade-in rounded-xl border border-border bg-card p-3 shadow-sm transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md"
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold tabular-nums">
                    {i + 4}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.name}</div>
                    {isSuper && (
                      <Badge variant="secondary" className="mt-0.5 text-[10px]">{DEPOT_LABEL[r.depot] || r.depot}</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black tabular-nums text-primary">{r.pts}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">pts</div>
                  </div>
                </div>
                {stage === "all" && (
                  <div className="mt-2 grid grid-cols-4 gap-1 border-t pt-2 text-center text-[10px]">
                    <div><div className="font-bold tabular-nums">{r.groupPts}</div><div className="text-muted-foreground">Grp</div></div>
                    <div><div className="font-bold tabular-nums">{r.koPts}</div><div className="text-muted-foreground">Final</div></div>
                    <div><div className="font-bold tabular-nums">{r.finalPts}</div><div className="text-muted-foreground">F</div></div>
                    <div><div className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{r.bonus}</div><div className="text-muted-foreground">Bns</div></div>
                  </div>
                )}
                <div className="mt-1.5 flex justify-end gap-3 text-[11px] text-muted-foreground">
                  <span>🎯 {r.exact}</span>
                  <span>✓ {r.good}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="mt-4 hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-muted/60 to-muted/30 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3 text-left">#</th>
                      <th className="px-3 py-3 text-left">Participant</th>
                      {isSuper && <th className="px-3 py-3 text-left">Unité</th>}
                      {stage === "all" && (
                        <>
                          <th className="px-3 py-3 text-right">Groupes</th>
                          <th className="px-3 py-3 text-right">Finales</th>
                          <th className="px-3 py-3 text-right">Finale</th>
                          <th className="px-3 py-3 text-right">Bonus</th>
                        </>
                      )}
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-3 py-3 text-right">Exacts</th>
                      <th className="px-3 py-3 text-right">Bons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((r, i) => (
                      <tr
                        key={r.user_id}
                        className="animate-fade-in border-t transition-colors hover:bg-primary/5"
                        style={{ animationDelay: `${Math.min(i, 15) * 25}ms`, animationFillMode: "backwards" }}
                      >
                        <td className="px-3 py-2.5 font-bold tabular-nums text-muted-foreground">{i + 4}</td>
                        <td className="px-3 py-2.5 font-medium">{r.name}</td>
                        {isSuper && <td className="px-3 py-2.5"><Badge variant="secondary">{DEPOT_LABEL[r.depot] || r.depot}</Badge></td>}
                        {stage === "all" && (
                          <>
                            <td className="px-3 py-2.5 text-right tabular-nums">{r.groupPts}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{r.koPts}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{r.finalPts}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{r.bonus}</td>
                          </>
                        )}
                        <td className="px-3 py-2.5 text-right text-base font-black tabular-nums text-primary">{r.pts}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.exact}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.good}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
