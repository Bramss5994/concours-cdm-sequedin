import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Crown } from "lucide-react";

export const Route = createFileRoute("/winner-board")({ component: WinnerBoard });

const DEPOTS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les dépôts" },
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
  { value: "tram", label: "Tram" },
  { value: "copem", label: "COPEM" },
  { value: "support", label: "Équipe Support" },
];
const DEPOT_LABEL: Record<string, string> = {
  sequedin: "Sequedin", faidherbe: "Faidherbe", wattrelos: "Wattrelos", pc_bus: "PC Bus", tram: "Tram", copem: "COPEM", support: "Équipe Support",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

function flagUrl(code: string | null | undefined) {
  if (!code) return null;
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

function WinnerBoard() {
  const { user, isAdmin } = useAuth();
  const [depotFilter, setDepotFilter] = useState<string>("all");

  const { data: myDepot } = useQuery({
    queryKey: ["my-depot", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("depot").eq("id", user!.id).maybeSingle();
      return (data?.depot as string | undefined) ?? null;
    },
  });

  useEffect(() => {
    if (isAdmin) setDepotFilter("all");
    else if (myDepot) setDepotFilter(myDepot);
  }, [isAdmin, myDepot]);


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["winner-board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_winner_board");
      if (error) throw error;
      return (data || []) as Array<{
        user_id: string; prenom: string; num_paie: string; depot: string;
        initial_team_id: string | null; initial_team_name: string | null; initial_team_code: string | null;
        final_team_id: string | null; final_team_name: string | null; final_team_code: string | null;
        bonus: number;
      }>;
    },
  });

  const board = useMemo(() => {
    return rows
      .filter((r) => depotFilter === "all" || r.depot === depotFilter)
      .map((r) => ({ ...r, name: `${r.prenom} ${r.num_paie}`.trim() || "Anonyme" }))
      .sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name));
  }, [rows, depotFilter]);

  const myPick = user ? board.find((r) => r.user_id === user.id) : null;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl text-center">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Classement Équipe gagnante réservé aux participants</h1>
          <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour consulter le classement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Crown className="h-7 w-7 text-primary" /> Équipe gagnante CDM
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Classement basé uniquement sur le pronostic de l'équipe championne du monde 2026.
          Bonus : 15 pts (choix initial conservé et gagnant), 10 pts (choix initial sans re-vote), 5 pts (re-vote gagnant).
        </p>
      </motion.div>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">Filtrer par dépôt (admin)</span>
          <Select value={depotFilter} onValueChange={setDepotFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="mt-4">
          <Badge variant="secondary" className="text-xs">
            Classement de l'unité {DEPOT_LABEL[depotFilter] || depotFilter}
          </Badge>
        </div>
      )}

      {myPick && (
        <Card className="mt-4 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Mon pronostic</div>
              <div className="mt-1 flex items-center gap-2 font-semibold">
                {flagUrl(myPick.initial_team_code) && (
                  <img src={flagUrl(myPick.initial_team_code)!} alt="" className="h-4 w-6 rounded-sm object-cover" />
                )}
                {myPick.initial_team_name || "—"}
              </div>
              {myPick.final_team_id && myPick.final_team_id !== myPick.initial_team_id && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  Re-vote :
                  {flagUrl(myPick.final_team_code) && (
                    <img src={flagUrl(myPick.final_team_code)!} alt="" className="h-3 w-5 rounded-sm object-cover" />
                  )}
                  {myPick.final_team_name}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">Bonus</div>
              <div className="text-2xl font-bold">{myPick.bonus}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement...</p>
          ) : board.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun pronostic « équipe gagnante » pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Participant</th>
                    {isAdmin && <th className="px-3 py-2 text-left">Unité</th>}
                    <th className="px-3 py-2 text-left">Choix initial</th>
                    <th className="px-3 py-2 text-left">Re-vote</th>
                    <th className="px-3 py-2 text-right">Bonus</th>
                  </tr>
                </thead>
                <motion.tbody initial="hidden" animate="visible" variants={stagger}>
                  {board.map((r, i) => (
                    <motion.tr key={r.user_id} variants={fadeUp} custom={i} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 font-bold">
                        {i === 0 ? <Trophy className="inline h-4 w-4 text-yellow-500" /> : i < 3 ? <Medal className="inline h-4 w-4 text-muted-foreground" /> : null} {i + 1}
                      </td>
                      <td className="px-3 py-2">{r.name}</td>
                      {isAdmin && <td className="px-3 py-2"><Badge variant="secondary">{DEPOT_LABEL[r.depot] || r.depot}</Badge></td>}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {flagUrl(r.initial_team_code) && (
                            <img src={flagUrl(r.initial_team_code)!} alt="" className="h-4 w-6 rounded-sm object-cover" />
                          )}
                          <span className="font-medium">{r.initial_team_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.final_team_id ? (
                          <div className="flex items-center gap-2">
                            {flagUrl(r.final_team_code) && (
                              <img src={flagUrl(r.final_team_code)!} alt="" className="h-4 w-6 rounded-sm object-cover" />
                            )}
                            <span>{r.final_team_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{r.bonus}</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
