import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Eye } from "lucide-react";
import {
  getUnitAdminSession,
  listUnitMatchesFn,
  listUnitPredictionsForMatchFn,
} from "@/lib/unit-admin.functions";

export const Route = createFileRoute("/unite/matchs")({
  component: UniteMatchsPage,
  head: () => ({ meta: [{ title: "Matchs — Admin d'unité" }] }),
});

const STAGE_LABEL: Record<string, string> = {
  group: "Phase de groupes",
  round_of_16: "8es",
  quarter: "Quarts",
  semi: "Demi",
  final: "Finale",
  third_place: "3e place",
};

function teamLabel(m: any, side: "a" | "b") {
  const t = side === "a" ? m.team_a : m.team_b;
  if (t) return t.name;
  return (side === "a" ? m.team_a_placeholder : m.team_b_placeholder) || "À déterminer";
}

function formatKick(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UniteMatchsPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getUnitAdminSession);
  const fetchMatches = useServerFn(listUnitMatchesFn);
  const fetchPreds = useServerFn(listUnitPredictionsForMatchFn);

  const sessionQ = useQuery({
    queryKey: ["unit-admin-session"],
    queryFn: () => fetchSession(),
  });

  useEffect(() => {
    if (sessionQ.isFetched && !sessionQ.data) {
      navigate({ to: "/unite/login", replace: true });
    }
  }, [sessionQ.isFetched, sessionQ.data, navigate]);

  const matchesQ = useQuery({
    queryKey: ["unit-admin-matches"],
    queryFn: () => fetchMatches(),
    enabled: !!sessionQ.data,
  });

  const [selected, setSelected] = useState<any | null>(null);
  const predsQ = useQuery({
    queryKey: ["unit-admin-preds", selected?.id],
    queryFn: () => fetchPreds({ data: { matchId: selected.id } }),
    enabled: !!selected,
  });

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const m of matchesQ.data ?? []) {
      const k = STAGE_LABEL[m.stage] ?? m.stage;
      (groups[k] ||= []).push(m);
    }
    return groups;
  }, [matchesQ.data]);

  if (!sessionQ.data) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Vérification…</div>;
  }
  const isSuper = (sessionQ.data as any).isSuper;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/unite">
              <ArrowLeft className="mr-1 h-4 w-4" /> Retour
            </Link>
          </Button>
          <h1 className="mt-2 text-xl font-bold sm:text-2xl">Matchs & pronostics</h1>
          <p className="text-sm text-muted-foreground">
            {isSuper
              ? "Consultation des matchs et des pronostics de toutes les unités."
              : "Consultation des matchs et des pronostics de votre unité."}
          </p>
        </div>
      </div>

      {matchesQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        Object.entries(grouped).map(([stage, items]) => (
          <Card key={stage} className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">{stage}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Match</th>
                      <th className="px-3 py-2 text-center">Score</th>
                      <th className="px-3 py-2 text-center">
                        {isSuper ? "Pronos totaux" : "Pronos unité"}
                      </th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="px-3 py-2 text-xs">{formatKick(m.kickoff_at)}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{teamLabel(m, "a")}</span>
                          <span className="mx-2 text-muted-foreground">vs</span>
                          <span className="font-medium">{teamLabel(m, "b")}</span>
                          {m.group_letter && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              Gr. {m.group_letter}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {m.finished && m.score_a != null && m.score_b != null
                            ? `${m.score_a} - ${m.score_b}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {m.depot_predictions_count}/{m.depot_participants_count}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(m)}
                            disabled={m.depot_predictions_count === 0}
                          >
                            <Eye className="mr-1 h-4 w-4" /> Voir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Pronostics — {selected ? teamLabel(selected, "a") : ""}{" "}
              vs {selected ? teamLabel(selected, "b") : ""}
            </DialogTitle>
          </DialogHeader>
          {predsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (predsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun pronostic dans votre unité.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Participant</th>
                    {isSuper && <th className="px-3 py-2 text-left">Unité</th>}
                    <th className="px-3 py-2 text-center">Pronostic</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {predsQ.data!.map((p: any) => (
                    <tr key={p.user_id} className="border-t">
                      <td className="px-3 py-2">
                        {p.prenom}{" "}
                        <span className="text-xs text-muted-foreground">{p.num_paie}</span>
                      </td>
                      {isSuper && <td className="px-3 py-2 text-xs">{p.depot}</td>}
                      <td className="px-3 py-2 text-center font-mono">
                        {p.score_a} - {p.score_b}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={p.points > 0 ? "default" : "secondary"}>
                          {p.points} pt{p.points > 1 ? "s" : ""}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
