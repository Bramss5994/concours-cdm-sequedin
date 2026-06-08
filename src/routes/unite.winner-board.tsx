import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trophy, Medal, Crown } from "lucide-react";
import { getUnitAdminSession, getUnitWinnerBoardFn } from "@/lib/unit-admin.functions";

export const Route = createFileRoute("/unite/winner-board")({
  component: UniteWinnerBoardPage,
  head: () => ({ meta: [{ title: "Classement équipe gagnante — Admin d'unité" }] }),
});

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

function flagUrl(code: string | null | undefined) {
  if (!code) return null;
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

function UniteWinnerBoardPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getUnitAdminSession);
  const fetchBoard = useServerFn(getUnitWinnerBoardFn);

  const sessionQ = useQuery({ queryKey: ["unit-admin-session"], queryFn: () => fetchSession() });

  useEffect(() => {
    if (sessionQ.isFetched && !sessionQ.data) navigate({ to: "/unite/login", replace: true });
  }, [sessionQ.isFetched, sessionQ.data, navigate]);

  const dataQ = useQuery({
    queryKey: ["unit-admin-winner-board"],
    queryFn: () => fetchBoard(),
    enabled: !!sessionQ.data,
  });

  const isSuper = (sessionQ.data as any)?.isSuper;
  const myDepot = sessionQ.data?.depot ?? "all";
  const [depotFilter, setDepotFilter] = useState<string>(isSuper ? "all" : myDepot);
  useEffect(() => { if (!isSuper && myDepot) setDepotFilter(myDepot); }, [isSuper, myDepot]);

  const rows = useMemo(() => {
    const list = (dataQ.data?.rows ?? []) as any[];
    const filtered = list.filter((r) => depotFilter === "all" || r.depot === depotFilter);
    return filtered.sort((a, b) => (b.bonus || 0) - (a.bonus || 0));
  }, [dataQ.data, depotFilter]);

  if (!sessionQ.data) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Vérification…</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2"><Crown className="h-6 w-6" /> Équipe gagnante</h1>
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

      <Card className="mt-4">
        <CardContent className="p-0">
          {dataQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun pronostic.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Participant</th>
                    {isSuper && <th className="px-3 py-2 text-left">Unité</th>}
                    <th className="px-3 py-2 text-left">Choix initial</th>
                    <th className="px-3 py-2 text-left">Re-vote</th>
                    <th className="px-3 py-2 text-right">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.user_id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 font-bold">
                        {i === 0 ? <Trophy className="inline h-4 w-4 text-yellow-500" /> : i < 3 ? <Medal className="inline h-4 w-4 text-muted-foreground" /> : null} {i + 1}
                      </td>
                      <td className="px-3 py-2">{`${r.prenom ?? ""} ${r.num_paie ?? ""}`.trim() || "Anonyme"}</td>
                      {isSuper && <td className="px-3 py-2"><Badge variant="secondary">{DEPOT_LABEL[r.depot] || r.depot}</Badge></td>}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.initial_team_code && <img src={flagUrl(r.initial_team_code) || ""} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                          <span>{r.initial_team_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.final_team_id ? (
                          <div className="flex items-center gap-2">
                            {r.final_team_code && <img src={flagUrl(r.final_team_code) || ""} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                            <span>{r.final_team_name}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-amber-600 dark:text-amber-400">{r.bonus}</td>
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
