import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { KeyRound, LogOut, Trash2, ShieldCheck, ListChecks, Settings, Eye, BarChart3, Target, Crown, Sparkles, Home } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFR } from "@/lib/time";
import {
  getUnitAdminSession,
  logoutUnitAdmin,
  listUnitParticipantsFn,
  toggleUnitParticipantFn,
  resetUnitParticipantPasswordFn,
  deleteUnitParticipantFn,
  getUnitParticipantPredictionsFn,
  getBonusPickOptionsFn,
  getUserBonusPicksFn,
  setUserWinnerPickFn,
  setUserTopScorerPickFn,
  deleteUserWinnerPickFn,
  deleteUserTopScorerPickFn,
} from "@/lib/unit-admin.functions";



export const Route = createFileRoute("/unite")({
  component: UnitePage,
  head: () => ({ meta: [{ title: "Espace admin d'unité" }] }),
});

const DEPOT_LABEL: Record<string, string> = {
  sequedin: "Sequedin",
  faidherbe: "Faidherbe",
  wattrelos: "Wattrelos",
  pc_bus: "PC Bus",
  tram: "Tram",
  copem: "COPEM",
  support: "Équipe Support",
};

function UnitePage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/unite") return <Outlet />;
  return <UniteDashboard />;
}

function UniteDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchSession = useServerFn(getUnitAdminSession);
  const doLogout = useServerFn(logoutUnitAdmin);
  const fetchList = useServerFn(listUnitParticipantsFn);
  const doToggle = useServerFn(toggleUnitParticipantFn);
  const doResetPwd = useServerFn(resetUnitParticipantPasswordFn);
  const doDelete = useServerFn(deleteUnitParticipantFn);

  const sessionQ = useQuery({
    queryKey: ["unit-admin-session"],
    queryFn: () => fetchSession(),
  });

  useEffect(() => {
    if (sessionQ.isFetched && !sessionQ.data) {
      navigate({ to: "/unite/login", replace: true });
    }
  }, [sessionQ.isFetched, sessionQ.data, navigate]);

  const listQ = useQuery({
    queryKey: ["unit-admin-participants"],
    queryFn: () => fetchList(),
    enabled: !!sessionQ.data,
  });

  const [pwdTarget, setPwdTarget] = useState<any | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [delTarget, setDelTarget] = useState<any | null>(null);
  const [predTarget, setPredTarget] = useState<any | null>(null);
  const [bonusTarget, setBonusTarget] = useState<any | null>(null);


  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState<string>("all");

  if (!sessionQ.data) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Vérification…</div>;
  }

  const depot = sessionQ.data.depot;
  const isSuper = (sessionQ.data as any).isSuper;
  const allList = listQ.data ?? [];
  const depotsAvailable = isSuper
    ? Array.from(new Set(allList.map((p: any) => p.depot as string))).sort()
    : [];
  const participants = allList.filter((p: any) => {
    if (isSuper && depotFilter !== "all" && p.depot !== depotFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.prenom || "").toLowerCase().includes(q) ||
      (p.num_paie || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.depot || "").toLowerCase().includes(q)
    );
  });

  async function handleToggle(id: string, active: boolean) {
    try {
      await doToggle({ data: { userId: id, active } });
      toast.success("Mis à jour");
      qc.invalidateQueries({ queryKey: ["unit-admin-participants"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function confirmResetPwd() {
    if (!pwdTarget) return;
    if (pwdValue.length < 8) return toast.error("8 caractères minimum");
    try {
      await doResetPwd({ data: { userId: pwdTarget.id, newPassword: pwdValue } });
      toast.success("Mot de passe réinitialisé");
      setPwdTarget(null);
      setPwdValue("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await doDelete({ data: { userId: delTarget.id } });
      toast.success("Supprimé");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["unit-admin-participants"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function handleLogout() {
    await doLogout();
    qc.removeQueries({ queryKey: ["unit-admin-session"] });
    qc.removeQueries({ queryKey: ["unit-admin-participants"] });
    navigate({ to: "/unite/login", replace: true });
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {isSuper ? "Super admin" : "Admin d'unité"}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={isSuper ? "default" : "secondary"}>
                {isSuper ? "Toutes les unités" : DEPOT_LABEL[depot] ?? depot}
              </Badge>
              <span className="text-xs">code : {sessionQ.data.login_code}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <Home className="mr-1 h-4 w-4" /> Accueil
            </Link>
          </Button>
          {isSuper && (
            <Button asChild variant="secondary" size="sm">
              <Link to="/unite/gestion">
                <Settings className="mr-1 h-4 w-4" /> Gestion globale
              </Link>
            </Button>
          )}
          <Button asChild variant="default" size="sm">
            <Link to="/unite/matchs">
              <ListChecks className="mr-1 h-4 w-4" /> Matchs & pronostics
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/unite/classement">
              <BarChart3 className="mr-1 h-4 w-4" /> Classement
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/unite/winner-board">
              <Crown className="mr-1 h-4 w-4" /> Équipe gagnante
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/unite/top-scorer">
              <Target className="mr-1 h-4 w-4" /> Soulier d'Or
            </Link>
          </Button>

          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" /> Déconnexion
          </Button>
        </div>

      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            {isSuper
              ? depotFilter === "all"
                ? `Tous les participants (${allList.length})`
                : `Participants — ${DEPOT_LABEL[depotFilter] ?? depotFilter} (${allList.filter((p: any) => p.depot === depotFilter).length})`
              : `Participants de l'unité (${allList.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isSuper && depotsAvailable.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={depotFilter === "all" ? "default" : "outline"}
                onClick={() => setDepotFilter("all")}
              >
                Toutes les unités
              </Button>
              {depotsAvailable.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={depotFilter === d ? "default" : "outline"}
                  onClick={() => setDepotFilter(d)}
                >
                  {DEPOT_LABEL[d] ?? d}
                </Button>
              ))}
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            <Input
              placeholder="Recherche prénom, n° paie, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 max-w-xs"
            />
            <span className="self-center text-xs text-muted-foreground">
              {participants.length} affiché(s)
            </span>
          </div>

          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun participant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Nom</th>
                    {isSuper && <th className="px-3 py-2 text-left">Unité</th>}
                    
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-center">Actif</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((u: any) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-3 py-2">
                        {u.prenom}{" "}
                        <span className="text-xs text-muted-foreground">{u.num_paie}</span>
                      </td>
                      {isSuper && (
                        <td className="px-3 py-2 text-xs">
                          <Badge variant="outline">{DEPOT_LABEL[u.depot] ?? u.depot}</Badge>
                        </td>
                      )}
                      
                      <td className="px-3 py-2 text-right font-semibold">{u.points}</td>
                      <td className="px-3 py-2 text-center">
                        <Switch
                          checked={u.active}
                          onCheckedChange={(v) => handleToggle(u.id, v)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Voir les pronostics"
                            onClick={() => setPredTarget(u)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isSuper && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Pronos bonus (équipe gagnante & soulier d'or)"
                              onClick={() => setBonusTarget(u)}
                            >
                              <Sparkles className="h-4 w-4 text-amber-500" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Réinitialiser mot de passe"
                            onClick={() => {
                              setPwdTarget(u);
                              setPwdValue("");
                            }}
                          >

                            <KeyRound className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            title="Supprimer"
                            onClick={() => setDelTarget(u)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pwdTarget} onOpenChange={(o) => !o && setPwdTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pour <strong>{pwdTarget?.prenom} {pwdTarget?.num_paie}</strong>
          </p>
          <Input
            type="text"
            placeholder="Nouveau mot de passe (min. 8 caractères)"
            value={pwdValue}
            onChange={(e) => setPwdValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdTarget(null)}>
              Annuler
            </Button>
            <Button onClick={confirmResetPwd}>Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce participant ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{delTarget?.prenom} {delTarget?.num_paie}</strong> et tous ses pronostics seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnitParticipantPredictionsDialog
        user={predTarget}
        onClose={() => setPredTarget(null)}
      />

      <BonusPicksDialog user={bonusTarget} onClose={() => setBonusTarget(null)} />

    </div>
  );
}

function UnitParticipantPredictionsDialog({
  user,
  onClose,
}: {
  user: any | null;
  onClose: () => void;
}) {
  const fetchPreds = useServerFn(getUnitParticipantPredictionsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["unit-admin-user-preds", user?.id],
    enabled: !!user,
    queryFn: () => fetchPreds({ data: { userId: user.id } }),
  });
  const preds = data?.predictions ?? [];
  const totalPoints = preds.reduce((s: number, p: any) => s + (p.points || 0), 0);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Pronostics — {user?.prenom}{" "}
            <span className="text-xs text-muted-foreground">{user?.num_paie}</span>
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : preds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun pronostic.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {preds.length} pronostic(s) · Total : <strong>{totalPoints} pts</strong>
            </p>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Match</th>
                    <th className="px-3 py-2 text-center">Score réel</th>
                    <th className="px-3 py-2 text-center">Pronostic</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {preds.map((p: any) => {
                    const m = p.match;
                    const nameA = m?.team_a?.name || m?.team_a_placeholder || "?";
                    const nameB = m?.team_b?.name || m?.team_b_placeholder || "?";
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 text-xs">
                          {m ? formatFR(m.kickoff_at) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {nameA} <span className="text-muted-foreground">vs</span> {nameB}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {m?.finished && m?.score_a != null
                            ? `${m.score_a} - ${m.score_b}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {p.score_a} - {p.score_b}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={p.points > 0 ? "default" : "secondary"}>
                            {p.points} pt{p.points > 1 ? "s" : ""}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BonusPicksDialog({ user, onClose }: { user: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchOptions = useServerFn(getBonusPickOptionsFn);
  const fetchPicks = useServerFn(getUserBonusPicksFn);
  const doSetWinner = useServerFn(setUserWinnerPickFn);
  const doSetScorer = useServerFn(setUserTopScorerPickFn);
  const doDelWinner = useServerFn(deleteUserWinnerPickFn);
  const doDelScorer = useServerFn(deleteUserTopScorerPickFn);

  const optionsQ = useQuery({
    queryKey: ["bonus-pick-options"],
    queryFn: () => fetchOptions(),
    enabled: !!user,
  });
  const picksQ = useQuery({
    queryKey: ["user-bonus-picks", user?.id],
    queryFn: () => fetchPicks({ data: { userId: user.id } }),
    enabled: !!user,
  });

  const [initialTeam, setInitialTeam] = useState<string>("");
  const [finalTeam, setFinalTeam] = useState<string>("");
  const [scorer, setScorer] = useState<string>("");

  useEffect(() => {
    if (picksQ.data) {
      setInitialTeam(picksQ.data.winner?.initial_team_id ?? "");
      setFinalTeam(picksQ.data.winner?.final_team_id ?? "");
      setScorer(picksQ.data.topScorer?.player_id ?? "");
    }
  }, [picksQ.data]);

  const teams = optionsQ.data?.teams ?? [];
  const players = optionsQ.data?.players ?? [];

  async function saveWinner() {
    if (!user || !initialTeam) return toast.error("Sélectionne une équipe gagnante initiale");
    try {
      await doSetWinner({
        data: {
          userId: user.id,
          initial_team_id: initialTeam,
          final_team_id: finalTeam || null,
        },
      });
      toast.success("Équipe gagnante enregistrée");
      qc.invalidateQueries({ queryKey: ["user-bonus-picks", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function saveScorer() {
    if (!user || !scorer) return toast.error("Sélectionne un joueur");
    try {
      await doSetScorer({ data: { userId: user.id, player_id: scorer } });
      toast.success("Meilleur buteur enregistré");
      qc.invalidateQueries({ queryKey: ["user-bonus-picks", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function clearWinner() {
    if (!user) return;
    try {
      await doDelWinner({ data: { userId: user.id } });
      toast.success("Choix supprimé");
      setInitialTeam("");
      setFinalTeam("");
      qc.invalidateQueries({ queryKey: ["user-bonus-picks", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function clearScorer() {
    if (!user) return;
    try {
      await doDelScorer({ data: { userId: user.id } });
      toast.success("Choix supprimé");
      setScorer("");
      qc.invalidateQueries({ queryKey: ["user-bonus-picks", user.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Pronos bonus — {user?.prenom}{" "}
            <span className="text-xs text-muted-foreground">{user?.num_paie}</span>
          </DialogTitle>
        </DialogHeader>

        {optionsQ.isLoading || picksQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold">Équipe gagnante</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Choix initial</label>
                  <Select value={initialTeam} onValueChange={setInitialTeam}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner une équipe" /></SelectTrigger>
                    <SelectContent>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Re-vote (optionnel)</label>
                  <Select value={finalTeam || "__none__"} onValueChange={(v) => setFinalTeam(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun re-vote</SelectItem>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {picksQ.data?.winner && (
                    <Button size="sm" variant="outline" onClick={clearWinner}>Supprimer</Button>
                  )}
                  <Button size="sm" onClick={saveWinner}>Enregistrer</Button>
                </div>
              </div>
            </section>

            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold">Soulier d'Or</h3>
              </div>
              <Select value={scorer} onValueChange={setScorer}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un joueur" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {players.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.team_name ? ` — ${p.team_name}` : ""}{p.club ? ` (${p.club})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2 pt-1">
                {picksQ.data?.topScorer && (
                  <Button size="sm" variant="outline" onClick={clearScorer}>Supprimer</Button>
                )}
                <Button size="sm" onClick={saveScorer}>Enregistrer</Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


