import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({ component: Leaderboard });

const STAGES = [
  { value: "all", label: "Général" },
  { value: "group", label: "Phase de groupes" },
  { value: "r32", label: "16es" },
  { value: "r16", label: "8es" },
  { value: "qf", label: "Quarts" },
  { value: "sf", label: "Demis" },
  { value: "final", label: "Finale" },
];

const DEPOTS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les dépôts" },
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
];
const DEPOT_LABEL: Record<string, string> = {
  sequedin: "Sequedin", faidherbe: "Faidherbe", wattrelos: "Wattrelos", pc_bus: "PC Bus",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

function Leaderboard() {
  const { user, isAdmin } = useAuth();
  const [stage, setStage] = useState("all");
  const [depotFilter, setDepotFilter] = useState<string>("all");

  // Récupère le dépôt de l'utilisateur connecté
  const { data: myDepot } = useQuery({
    queryKey: ["my-depot", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("depot").eq("id", user!.id).maybeSingle();
      return (data?.depot as string | undefined) ?? null;
    },
  });

  // Verrouille le filtre sur le dépôt de l'utilisateur (sauf admin)
  useEffect(() => {
    if (!isAdmin && myDepot) setDepotFilter(myDepot);
  }, [isAdmin, myDepot]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard-data"],
    queryFn: async () => {
      const [{ data: profiles }, { data: predictions }, { data: matches }] = await Promise.all([
        supabase.rpc("get_public_profiles"),
        supabase.from("predictions").select("user_id, match_id, points, exact_score, good_winner"),
        supabase.from("matches").select("id, stage, finished"),
      ]);
      return { profiles: profiles || [], predictions: predictions || [], matches: matches || [] };
    },
  });


  const board = useMemo(() => {
    const r = rows as any;
    if (!r || !r.profiles) return [];
    const matchById = new Map<string, any>(r.matches.map((m: any) => [m.id, m]));
    const stats = new Map<string, { user_id: string; name: string; depot: string; pts: number; exact: number; good: number; }>();
    for (const p of r.profiles) {
      if (p.active === false) continue;
      if (depotFilter !== "all" && p.depot !== depotFilter) continue;
      stats.set(p.id, { user_id: p.id, name: `${p.prenom} ${p.num_paie}`.trim() || "Anonyme", depot: p.depot || "sequedin", pts: 0, exact: 0, good: 0 });
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
  }, [rows, stage, depotFilter]);

  const myRank = useMemo(() => {
    if (!user) return null;
    const idx = board.findIndex((r) => r.user_id === user.id);
    if (idx === -1) return null;
    return { rank: idx + 1, total: board.length, ...board[idx] };
  }, [board, user]);

  const depotScopeLabel =
    !isAdmin || depotFilter !== "all" ? `unité ${DEPOT_LABEL[depotFilter] || depotFilter}` : "toutes unités";

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-xl text-center"
        >
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Classement réservé aux participants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pour consulter le classement, tu dois d'abord t'inscrire à ton unité.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl font-bold sm:text-3xl"
      >Classement</motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-1 text-sm text-muted-foreground"
      >{isAdmin ? "Toutes les unités — mis à jour après chaque match." : `Unité ${DEPOT_LABEL[depotFilter] || depotFilter} — mis à jour après chaque match.`}</motion.p>

      {isAdmin ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs uppercase text-muted-foreground">Filtrer par dépôt (admin)</span>
          <Select value={depotFilter} onValueChange={setDepotFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-4"
        >
          <Badge variant="secondary" className="text-xs">
            Classement de l'unité {DEPOT_LABEL[depotFilter] || depotFilter}
          </Badge>
        </motion.div>
      )}


      {user && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
          className="mt-4"
        >
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Ma position · {depotScopeLabel}</div>
                {myRank ? (
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">#{myRank.rank}</span>
                    <span className="text-sm text-muted-foreground">sur {myRank.total}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {depotFilter === "all" ? "Aucun pronostic comptabilisé pour l'instant." : "Tu n'es pas dans ce dépôt."}
                  </div>
                )}
              </div>
              {myRank && (
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Points</div>
                    <div className="text-2xl font-bold">{myRank.pts}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Exacts</div>
                    <div className="text-2xl font-bold">{myRank.exact}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Vainqueurs</div>
                    <div className="text-2xl font-bold">{myRank.good}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Tabs value={stage} onValueChange={setStage} className="mt-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {STAGES.map((s) => <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
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
                      <th className="px-3 py-2 text-left">Dépôt</th>
                      <th className="px-3 py-2 text-right">Points</th>
                      <th className="px-3 py-2 text-right">Scores exacts</th>
                      <th className="px-3 py-2 text-right">Bons vainqueurs</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    initial="hidden"
                    animate="visible"
                    variants={staggerContainer}
                  >
                    {board.map((r, i) => (
                      <motion.tr
                        key={r.user_id}
                        variants={fadeUp}
                        custom={i}
                        className="border-t transition-colors hover:bg-muted/40"
                      >
                        <td className="px-3 py-2 font-bold">
                          {i === 0 ? <Trophy className="inline h-4 w-4 text-yellow-500" /> : i < 3 ? <Medal className="inline h-4 w-4 text-muted-foreground" /> : null} {i + 1}
                        </td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2"><Badge variant="secondary">{DEPOT_LABEL[r.depot] || r.depot}</Badge></td>
                        <td className="px-3 py-2 text-right font-bold">{r.pts}</td>
                        <td className="px-3 py-2 text-right">{r.exact}</td>
                        <td className="px-3 py-2 text-right">{r.good}</td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
