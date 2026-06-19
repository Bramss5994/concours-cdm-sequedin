import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowLeft, KeyRound, ShieldPlus, Trash2, RefreshCw, Trophy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatFR } from "@/lib/time";
import {
  getUnitAdminSession,
  getSuperAdminStatsFn,
  listAdminMatchesFn,
  updateAdminMatchFn,
  markMatchesFinishedFn,
  listAllUnitAdminsFn,
  createUnitAdminAsSuperFn,
  resetUnitAdminPwdAsSuperFn,
  toggleUnitAdminAsSuperFn,
  deleteUnitAdminAsSuperFn,
} from "@/lib/unit-admin.functions";
import {
  syncBracketTeamsAsUnitAdminFn,
  backfillGoalscorersAsUnitAdminFn,
} from "@/lib/bracket-sync.functions";

export const Route = createFileRoute("/unite/gestion")({
  component: GestionPage,
  head: () => ({ meta: [{ title: "Gestion globale — Super admin" }] }),
});

const UNIT_DEPOTS = [
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
  { value: "tram", label: "Tram" },
  { value: "copem", label: "COPEM" },
  { value: "support", label: "Équipe Support" },
];

function GestionPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getUnitAdminSession);
  const sessionQ = useQuery({
    queryKey: ["unit-admin-session"],
    queryFn: () => fetchSession(),
  });

  useEffect(() => {
    if (sessionQ.isFetched && !sessionQ.data) {
      navigate({ to: "/unite/login", replace: true });
    } else if (sessionQ.isFetched && sessionQ.data && !(sessionQ.data as any).isSuper) {
      navigate({ to: "/unite", replace: true });
    }
  }, [sessionQ.isFetched, sessionQ.data, navigate]);

  if (!sessionQ.data || !(sessionQ.data as any).isSuper) {
    return <div className="container mx-auto p-6 text-sm text-muted-foreground">Vérification…</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Gestion globale</h1>
          <p className="text-xs text-muted-foreground">Accès super admin (Sequedin) — toutes les unités.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/unite">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="stats" className="mt-4">
        <TabsList>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="matches">Matchs</TabsTrigger>
          <TabsTrigger value="bracket">Tableau final</TabsTrigger>
          <TabsTrigger value="unit-admins">Admins d'unité</TabsTrigger>
        </TabsList>
        <TabsContent value="stats"><StatsTab /></TabsContent>
        <TabsContent value="matches"><MatchesTab /></TabsContent>
        <TabsContent value="bracket"><BracketTab /></TabsContent>
        <TabsContent value="unit-admins"><UnitAdminsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------- STATS ----------------------- */

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatsTab() {
  const fetchStats = useServerFn(getSuperAdminStatsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["super-stats"],
    queryFn: () => fetchStats(),
  });

  const computed = useMemo(() => {
    if (!data) return null;
    const totalUsers = data.profiles.length;
    const activeUsers = data.profiles.filter((p: any) => p.active).length;
    const totalPreds = data.preds.length;
    const expected = totalUsers * data.matches.length;
    const participation = expected > 0 ? Math.round((totalPreds / expected) * 100) : 0;

    const pointsBy = new Map<string, number>();
    for (const p of data.preds) pointsBy.set(p.user_id, (pointsBy.get(p.user_id) || 0) + (p.points || 0));
    const top10 = [...data.profiles]
      .map((p: any) => ({ ...p, points: pointsBy.get(p.id) || 0 }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    const byDay = new Map<string, number>();
    for (const p of data.profiles) {
      const d = (p.created_at || "").slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const signups = [...byDay.entries()].sort().map(([date, count]) => ({ date, count }));

    return { totalUsers, activeUsers, totalPreds, participation, top10, signups };
  }, [data]);

  if (isLoading || !computed) return <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Inscrits" value={computed.totalUsers} />
        <Kpi label="Actifs" value={computed.activeUsers} />
        <Kpi label="Pronostics" value={computed.totalPreds} />
        <Kpi label="Participation" value={`${computed.participation}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 du classement</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {computed.top10.map((u: any, i: number) => (
                  <tr key={u.id} className="border-t">
                    <td className="w-10 px-3 py-2 text-muted-foreground">#{i + 1}</td>
                    <td className="px-3 py-2">{u.prenom} <span className="text-xs text-muted-foreground">{u.num_paie}</span></td>
                    <td className="px-3 py-2 text-right font-semibold">{u.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Évolution des inscriptions</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <LineChart data={computed.signups}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------- MATCHES ----------------------- */

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function MatchesTab() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listAdminMatchesFn);
  const doUpdate = useServerFn(updateAdminMatchFn);
  const doMarkFinished = useServerFn(markMatchesFinishedFn);

  const { data: matches = [] } = useQuery({
    queryKey: ["super-matches"],
    queryFn: () => fetchList(),
  });

  const [matchdayFilter, setMatchdayFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const matchdays = useMemo(
    () => [...new Set(matches.map((m: any) => m.matchday).filter((x: any) => x != null))].sort((a: any, b: any) => a - b),
    [matches],
  );
  const stages = useMemo(() => [...new Set(matches.map((m: any) => m.stage))], [matches]);

  const filtered = matches.filter((m: any) => {
    if (matchdayFilter !== "all" && String(m.matchday) !== matchdayFilter) return false;
    if (stageFilter !== "all" && m.stage !== stageFilter) return false;
    return true;
  });

  async function save(id: string, patch: { score_a: number | null; score_b: number | null; finished: boolean; kickoff_at?: string }) {
    try {
      await doUpdate({ data: { id, ...patch } });
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["super-matches"] });
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
      return false;
    }
  }

  const [syncing, setSyncing] = useState(false);
  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/public/hooks/sync-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(`Synchro OK — ${json.updated} match(s) mis à jour`);
      qc.invalidateQueries({ queryKey: ["super-matches"] });
    } catch (e: any) {
      toast.error(`Synchro échouée : ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function markAllFinished() {
    const targets = filtered.filter((m: any) => !m.finished && m.score_a != null && m.score_b != null);
    if (targets.length === 0) { toast.info("Rien à valider"); return; }
    try {
      await doMarkFinished({ data: { ids: targets.map((m: any) => m.id) } });
      toast.success(`${targets.length} match(s) validés`);
      qc.invalidateQueries({ queryKey: ["super-matches"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <p className="font-semibold">Synchronisation auto des scores</p>
          <p className="text-xs text-muted-foreground">Sync toutes les 15 min depuis API-Football.</p>
        </div>
        <Button size="sm" onClick={syncNow} disabled={syncing}>
          {syncing ? "Synchro…" : "Synchroniser maintenant"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes phases</SelectItem>
            {stages.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={matchdayFilter} onValueChange={setMatchdayFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Journée" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes journées</SelectItem>
            {matchdays.map((d: any) => <SelectItem key={d} value={String(d)}>Journée {d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="secondary" onClick={markAllFinished}>
          Valider tous les matchs filtrés
        </Button>
        <span className="text-xs text-muted-foreground">{filtered.length} match(s)</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Match</th>
                  <th className="px-3 py-2">Date / heure</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Validé</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => <MatchRow key={m.id} m={m} onSave={save} />)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MatchRow({ m, onSave }: { m: any; onSave: (id: string, patch: any) => Promise<boolean> }) {
  const [sa, setSa] = useState(m.score_a != null ? String(m.score_a) : "");
  const [sb, setSb] = useState(m.score_b != null ? String(m.score_b) : "");
  const [fin, setFin] = useState<boolean>(m.finished);
  const [kickoff, setKickoff] = useState(toLocalInput(m.kickoff_at));
  const nameA = m.team_a?.name || m.team_a_placeholder || "?";
  const nameB = m.team_b?.name || m.team_b_placeholder || "?";

  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        {nameA} - {nameB}{" "}
        <span className="ml-2 text-xs uppercase text-muted-foreground">
          {m.stage}{m.group_letter ? ` ${m.group_letter}` : ""}{m.matchday ? ` · J${m.matchday}` : ""}
        </span>
      </td>
      <td className="px-3 py-2">
        <Input
          type="datetime-local"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
          className="h-8 w-48"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">{formatFR(m.kickoff_at)}</p>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Input type="number" min={0} max={20} value={sa} onChange={(e) => setSa(e.target.value)} className="h-8 w-14 text-center" />
          <span>-</span>
          <Input type="number" min={0} max={20} value={sb} onChange={(e) => setSb(e.target.value)} className="h-8 w-14 text-center" />
        </div>
      </td>
      <td className="px-3 py-2 text-center"><Switch checked={fin} onCheckedChange={setFin} /></td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" onClick={async () => {
          const a = sa === "" ? null : Number(sa);
          const b = sb === "" ? null : Number(sb);
          if (fin && (a == null || b == null)) { toast.error("Scores requis pour valider"); return; }
          const patch: any = { score_a: a, score_b: b, finished: fin };
          const newIso = fromLocalInput(kickoff);
          if (newIso && newIso !== m.kickoff_at) patch.kickoff_at = newIso;
          await onSave(m.id, patch);
        }}>Enregistrer</Button>
      </td>
    </tr>
  );
}

/* ----------------------- BRACKET ----------------------- */

function BracketTab() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncBracketTeamsAsUnitAdminFn);
  const backfillFn = useServerFn(backfillGoalscorersAsUnitAdminFn);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [lastSync, setLastSync] = useState<any | null>(null);
  const [lastBackfill, setLastBackfill] = useState<any | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      const res: any = await syncFn();
      setLastSync(res);
      if (!res.ok) {
        toast.error(`Échec : ${res.error}`);
      } else {
        toast.success(`Tableau synchronisé : ${res.updated} match(s) mis à jour`);
        qc.invalidateQueries({ queryKey: ["bracket-matches"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["super-matches"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inconnue");
    } finally {
      setSyncing(false);
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    try {
      const res: any = await backfillFn();
      setLastBackfill(res);
      if (!res.ok) {
        toast.error(`Échec : ${res.error}`);
      } else {
        toast.success(`Buteurs rafraîchis : ${res.updated}/${res.processed} match(s)`);
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["bracket-matches"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur inconnue");
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Tableau final — Phase à élimination directe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-semibold">Synchroniser les équipes qualifiées</p>
            <p className="text-xs text-muted-foreground">
              Récupère via API-Football les fixtures des 16es à la finale et place les équipes qualifiées dans le tableau.
            </p>
            <div className="mt-3">
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Synchronisation…" : "Synchroniser via API Football"}
              </Button>
            </div>
            {lastSync && lastSync.ok && (
              <div className="mt-3 space-y-1 text-xs">
                <p>
                  <span className="font-semibold">{lastSync.updated}</span> match(s) mis à jour ·{" "}
                  <span className="text-muted-foreground">{lastSync.checkedFixtures} fixtures analysés</span>
                </p>
                {lastSync.details?.length > 0 && (
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {lastSync.details.slice(0, 10).map((d: any, i: number) => (
                      <li key={i}>
                        [{d.stage}] {d.slot} → {d.home} vs {d.away}
                      </li>
                    ))}
                  </ul>
                )}
                {lastSync.errors?.length > 0 && (
                  <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      {lastSync.errors.length} avertissement(s)
                    </p>
                    <ul className="ml-4 list-disc">
                      {lastSync.errors.slice(0, 10).map((e: string, i: number) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-semibold">Rafraîchir les buteurs manquants</p>
            <p className="text-xs text-muted-foreground">
              Pour les matchs terminés avec score &gt; 0 mais sans buteurs renseignés (max 6 par exécution, espacés pour respecter la limite API).
            </p>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={handleBackfill} disabled={backfilling}>
                <RefreshCw className={`mr-1 h-4 w-4 ${backfilling ? "animate-spin" : ""}`} />
                {backfilling ? "En cours…" : "Rafraîchir buteurs manquants"}
              </Button>
            </div>
            {lastBackfill && lastBackfill.ok && (
              <div className="mt-3 text-xs">
                <p>
                  <span className="font-semibold">{lastBackfill.updated}</span> / {lastBackfill.processed} match(s) mis à jour
                </p>
                {lastBackfill.errors?.length > 0 && (
                  <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      {lastBackfill.errors.length} avertissement(s)
                    </p>
                    <ul className="ml-4 list-disc">
                      {lastBackfill.errors.slice(0, 10).map((e: string, i: number) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------- UNIT ADMINS ----------------------- */


function UnitAdminsTab() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listAllUnitAdminsFn);
  const doCreate = useServerFn(createUnitAdminAsSuperFn);
  const doReset = useServerFn(resetUnitAdminPwdAsSuperFn);
  const doToggle = useServerFn(toggleUnitAdminAsSuperFn);
  const doDelete = useServerFn(deleteUnitAdminAsSuperFn);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["super-unit-admins"],
    queryFn: () => fetchList(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [nDepot, setNDepot] = useState("faidherbe");
  const [nCode, setNCode] = useState("");
  const [nPwd, setNPwd] = useState("");

  const [pwdTarget, setPwdTarget] = useState<any | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [delTarget, setDelTarget] = useState<any | null>(null);

  async function submitCreate() {
    if (nCode.trim().length < 3) return toast.error("Code trop court");
    if (nPwd.length < 8) return toast.error("Mot de passe min. 8 caractères");
    try {
      await doCreate({ data: { depot: nDepot as any, login_code: nCode.trim(), password: nPwd } });
      toast.success("Admin d'unité créé");
      setCreateOpen(false);
      setNCode("");
      setNPwd("");
      qc.invalidateQueries({ queryKey: ["super-unit-admins"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await doToggle({ data: { id, active } });
      qc.invalidateQueries({ queryKey: ["super-unit-admins"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function confirmReset() {
    if (!pwdTarget) return;
    if (pwdValue.length < 8) return toast.error("8 caractères minimum");
    try {
      await doReset({ data: { id: pwdTarget.id, password: pwdValue } });
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
      await doDelete({ data: { id: delTarget.id } });
      toast.success("Supprimé");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["super-unit-admins"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <p className="font-semibold">Admins d'unité</p>
          <p className="text-xs text-muted-foreground">Connexion via /unite/login par code + mot de passe.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <ShieldPlus className="mr-1 h-4 w-4" /> Créer un admin
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun admin d'unité.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Dépôt</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-center">Actif</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a: any) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2">
                        {UNIT_DEPOTS.find((d) => d.value === a.depot)?.label ?? a.depot}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{a.login_code}</td>
                      <td className="px-3 py-2 text-center">
                        <Switch checked={a.active} onCheckedChange={(v) => toggleActive(a.id, v)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Réinitialiser mot de passe"
                            onClick={() => { setPwdTarget(a); setPwdValue(""); }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Supprimer"
                            onClick={() => setDelTarget(a)}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un admin d'unité</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">Dépôt</label>
              <Select value={nDepot} onValueChange={setNDepot}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_DEPOTS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Code de connexion</label>
              <Input
                value={nCode}
                onChange={(e) => setNCode(e.target.value.toUpperCase())}
                placeholder="EX: FAID-ADM"
                className="uppercase"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Lettres, chiffres et tirets. 3 à 32 caractères. Stocké en majuscules.
              </p>
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Mot de passe initial</label>
              <Input
                type="text"
                value={nPwd}
                onChange={(e) => setNPwd(e.target.value)}
                placeholder="Min. 8 caractères"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={submitCreate}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdTarget} onOpenChange={(o) => !o && setPwdTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pour <strong>{pwdTarget?.login_code}</strong>
          </p>
          <Input
            type="text"
            placeholder="Nouveau mot de passe (min. 8 caractères)"
            value={pwdValue}
            onChange={(e) => setPwdValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdTarget(null)}>Annuler</Button>
            <Button onClick={confirmReset}>Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet admin d'unité ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{delTarget?.login_code}</strong> ne pourra plus se connecter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
