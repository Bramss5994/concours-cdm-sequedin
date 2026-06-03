import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { formatFR } from "@/lib/time";
import { deleteUserFn, resetUserPasswordFn } from "@/lib/admin.functions";
import {
  listUnitAdminsFn,
  createUnitAdminFn,
  resetUnitAdminPasswordFn,
  toggleUnitAdminFn,
  deleteUnitAdminFn,
  isSequedinSuperAdminFn,
} from "@/lib/super-admin.functions";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trash2, KeyRound, Download, ShieldPlus, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const fetchIsSuper = useServerFn(isSequedinSuperAdminFn);
  const { data: isSuper } = useQuery({
    queryKey: ["is-sequedin-super"],
    queryFn: () => fetchIsSuper(),
    enabled: !!user && isAdmin,
  });
  if (loading) return null;
  if (!user) return <div className="container mx-auto p-6">Connexion requise.</div>;
  if (!isAdmin) return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold">Espace admin</h1>
      <p className="mt-2 text-muted-foreground">Vous n'avez pas les droits d'administrateur.</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Administration</h1>
      <Tabs defaultValue="stats" className="mt-4">
        <TabsList>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="results">Matchs</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          {isSuper && <TabsTrigger value="unit-admins">Admins d'unité</TabsTrigger>}
        </TabsList>
        <TabsContent value="stats"><AdminStats /></TabsContent>
        <TabsContent value="results"><AdminResults /></TabsContent>
        <TabsContent value="users"><AdminUsers /></TabsContent>
        {isSuper && <TabsContent value="unit-admins"><AdminUnitAdmins /></TabsContent>}
      </Tabs>
    </div>
  );
}

/* ----------------------------- STATS ----------------------------- */

function AdminStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ data: profiles }, { data: preds }, { data: matches }] = await Promise.all([
        supabase.from("profiles").select("id, prenom, num_paie, active, created_at, depot"),
        supabase.from("predictions").select("user_id, points, match_id, updated_at"),
        supabase.from("matches").select("id, finished, kickoff_at"),
      ]);
      return { profiles: profiles || [], preds: preds || [], matches: matches || [] };
    },
  });

  const computed = useMemo(() => {
    if (!data) return null;
    const totalUsers = data.profiles.length;
    const activeUsers = data.profiles.filter((p: any) => p.active).length;
    const finishedMatches = data.matches.filter((m: any) => m.finished).length;
    const totalPreds = data.preds.length;
    const expected = totalUsers * data.matches.length;
    const participation = expected > 0 ? Math.round((totalPreds / expected) * 100) : 0;

    // Top 10 by points
    const pointsBy = new Map<string, number>();
    for (const p of data.preds) pointsBy.set(p.user_id, (pointsBy.get(p.user_id) || 0) + (p.points || 0));
    const top10 = [...data.profiles]
      .map((p: any) => ({ ...p, points: pointsBy.get(p.id) || 0 }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    // Signups per day
    const byDay = new Map<string, number>();
    for (const p of data.profiles) {
      const d = (p.created_at || "").slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const signups = [...byDay.entries()].sort().map(([date, count]) => ({ date, count }));

    // Inactive users for last 3 finished matches
    const lastFinishedIds = [...data.matches]
      .filter((m: any) => m.finished)
      .sort((a: any, b: any) => b.kickoff_at.localeCompare(a.kickoff_at))
      .slice(0, 3)
      .map((m: any) => m.id);
    const predBy = new Map<string, Set<string>>();
    for (const p of data.preds) {
      if (!predBy.has(p.user_id)) predBy.set(p.user_id, new Set());
      predBy.get(p.user_id)!.add(p.match_id);
    }
    const inactives = data.profiles.filter((p: any) => {
      const set = predBy.get(p.id);
      return lastFinishedIds.length > 0 && lastFinishedIds.every((id) => !set?.has(id));
    });

    return { totalUsers, activeUsers, finishedMatches, totalPreds, participation, top10, signups, inactives };
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Utilisateurs inactifs ({computed.inactives.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">
            Aucun pronostic sur les 3 derniers matchs terminés.
          </p>
          {computed.inactives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tous les utilisateurs participent.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {computed.inactives.map((u: any) => (
                <span key={u.id} className="rounded border bg-muted/40 px-2 py-1 text-xs">
                  {u.prenom} · {u.num_paie}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

/* ----------------------------- MATCHES ----------------------------- */

function AdminResults() {
  const qc = useQueryClient();
  const [matchdayFilter, setMatchdayFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: matches = [] } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, team_a:teams!matches_team_a_id_fkey(code,name), team_b:teams!matches_team_b_id_fkey(code,name)")
        .order("kickoff_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const matchdays = useMemo(
    () => [...new Set(matches.map((m: any) => m.matchday).filter((x: any) => x != null))].sort((a: any, b: any) => a - b),
    [matches],
  );
  const stages = useMemo(
    () => [...new Set(matches.map((m: any) => m.stage))],
    [matches],
  );

  const filtered = matches.filter((m: any) => {
    if (matchdayFilter !== "all" && String(m.matchday) !== matchdayFilter) return false;
    if (stageFilter !== "all" && m.stage !== stageFilter) return false;
    return true;
  });

  async function save(id: string, patch: Record<string, any>) {
    const { error } = await supabase.from("matches").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries();
    return true;
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
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(`Synchro échouée : ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function markAllFinished() {
    const targets = filtered.filter((m: any) => !m.finished && m.score_a != null && m.score_b != null);
    if (targets.length === 0) { toast.info("Rien à valider (scores manquants ou déjà validés)"); return; }
    const { error } = await supabase.from("matches").update({ finished: true }).in("id", targets.map((m: any) => m.id));
    if (error) toast.error(error.message);
    else { toast.success(`${targets.length} match(s) validés`); qc.invalidateQueries(); }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <p className="font-semibold">Agent IA — mise à jour automatique des scores</p>
          <p className="text-xs text-muted-foreground">Synchro toutes les 15 min depuis API-Football.</p>
        </div>
        <Button size="sm" onClick={syncNow} disabled={syncing}>
          {syncing ? "Synchro…" : "Synchroniser maintenant"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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

      <Card className="mt-4">
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
                {filtered.map((m: any) => <ResultRow key={m.id} m={m} onSave={save} />)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ResultRow({ m, onSave }: { m: any; onSave: (id: string, patch: Record<string, any>) => Promise<boolean> }) {
  const [sa, setSa] = useState<string>(m.score_a != null ? String(m.score_a) : "");
  const [sb, setSb] = useState<string>(m.score_b != null ? String(m.score_b) : "");
  const [fin, setFin] = useState<boolean>(m.finished);
  const [kickoff, setKickoff] = useState<string>(toLocalInput(m.kickoff_at));
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
          const ok = await onSave(m.id, patch);
          if (ok) toast.success("Enregistré");
        }}>Enregistrer</Button>
      </td>
    </tr>
  );
}

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

/* ----------------------------- USERS ----------------------------- */

function AdminUsers() {
  const qc = useQueryClient();
  const deleteUser = useServerFn(deleteUserFn);
  const resetPwd = useServerFn(resetUserPasswordFn);

  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState<string>("all");

  const [pwdTarget, setPwdTarget] = useState<any | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [delTarget, setDelTarget] = useState<any | null>(null);
  const [predTarget, setPredTarget] = useState<any | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, string[]>();
      for (const r of roles || []) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      }
      return (profiles || []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) || [] }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u: any) => {
      if (depotFilter !== "all" && u.depot !== depotFilter) return false;
      if (!q) return true;
      return (
        (u.prenom || "").toLowerCase().includes(q) ||
        (u.num_paie || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [users, search, depotFilter]);

  async function toggleActive(id: string, next: boolean) {
    const { error } = await supabase.from("profiles").update({ active: next }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("OK"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  }
  async function toggleAdmin(id: string, makeAdmin: boolean) {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
      if (error) return toast.error(error.message);
    }
    toast.success("Rôle mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await deleteUser({ data: { userId: delTarget.id } });
      toast.success("Utilisateur supprimé");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  }

  async function confirmResetPwd() {
    if (!pwdTarget) return;
    if (pwdValue.length < 8) { toast.error("8 caractères minimum"); return; }
    try {
      await resetPwd({ data: { userId: pwdTarget.id, newPassword: pwdValue } });
      toast.success("Mot de passe réinitialisé");
      setPwdTarget(null);
      setPwdValue("");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  }

  function exportCSV() {
    const headers = ["prenom", "num_paie", "email", "depot", "active", "admin", "created_at"];
    const rows = filtered.map((u: any) => [
      u.prenom, u.num_paie, u.email, u.depot, u.active ? "oui" : "non",
      u.roles.includes("admin") ? "oui" : "non", u.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscrits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Recherche prénom, n° paie, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Select value={depotFilter} onValueChange={setDepotFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Dépôt" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous dépôts</SelectItem>
            <SelectItem value="sequedin">Sequedin</SelectItem>
            <SelectItem value="faidherbe">Faidherbe</SelectItem>
            <SelectItem value="wattrelos">Wattrelos</SelectItem>
            <SelectItem value="pc_bus">PC Bus</SelectItem>
            <SelectItem value="tram">Tram</SelectItem>
            <SelectItem value="copem">COPEM</SelectItem>
            <SelectItem value="support">Équipe Support</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
        <span className="text-xs text-muted-foreground">{filtered.length} / {users.length}</span>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Dépôt</th>
                  <th className="px-3 py-2 text-center">Actif</th>
                  <th className="px-3 py-2 text-center">Admin</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">{u.prenom} <span className="text-xs text-muted-foreground">{u.num_paie}</span></td>
                    <td className="px-3 py-2 text-xs">{u.email}</td>
                    <td className="px-3 py-2 text-xs">{u.depot}</td>
                    <td className="px-3 py-2 text-center"><Switch checked={u.active} onCheckedChange={(v) => toggleActive(u.id, v)} /></td>
                    <td className="px-3 py-2 text-center"><Switch checked={u.roles.includes("admin")} onCheckedChange={(v) => toggleAdmin(u.id, v)} /></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Voir les pronostics"
                          onClick={() => setPredTarget(u)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Réinitialiser mot de passe"
                          onClick={() => { setPwdTarget(u); setPwdValue(""); }}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Supprimer"
                          onClick={() => setDelTarget(u)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <Button variant="outline" onClick={() => setPwdTarget(null)}>Annuler</Button>
            <Button onClick={confirmResetPwd}>Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{delTarget?.prenom} {delTarget?.num_paie}</strong> et tous ses pronostics seront supprimés définitivement.
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
      <UserPredictionsDialog user={predTarget} onClose={() => setPredTarget(null)} />
    </>
  );
}

/* ----------------------------- USER PREDICTIONS ----------------------------- */

function UserPredictionsDialog({ user, onClose }: { user: any | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-preds", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: preds, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((preds || []).map((p: any) => p.match_id))];
      const { data: matches } = await supabase
        .from("matches")
        .select("id, stage, group_letter, matchday, kickoff_at, score_a, score_b, finished, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), team_a_placeholder, team_b_placeholder")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const mMap = new Map((matches || []).map((m: any) => [m.id, m]));
      return (preds || []).map((p: any) => ({ ...p, match: mMap.get(p.match_id) }));
    },
  });

  const totalPoints = (data || []).reduce((s: number, p: any) => s + (p.points || 0), 0);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Pronostics — {user?.prenom} <span className="text-xs text-muted-foreground">{user?.num_paie}</span>
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun pronostic.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {(data || []).length} pronostic(s) · Total : <strong>{totalPoints} pts</strong>
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
                  {(data || []).map((p: any) => {
                    const m = p.match;
                    const nameA = m?.team_a?.name || m?.team_a_placeholder || "?";
                    const nameB = m?.team_b?.name || m?.team_b_placeholder || "?";
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 text-xs">{m ? formatFR(m.kickoff_at) : "—"}</td>
                        <td className="px-3 py-2">{nameA} <span className="text-muted-foreground">vs</span> {nameB}</td>
                        <td className="px-3 py-2 text-center font-mono">
                          {m?.finished && m?.score_a != null ? `${m.score_a} - ${m.score_b}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{p.score_a} - {p.score_b}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={p.points > 0 ? "default" : "secondary"}>{p.points} pt{p.points > 1 ? "s" : ""}</Badge>
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

const UNIT_DEPOTS: { value: string; label: string }[] = [
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
  { value: "tram", label: "Tram" },
  { value: "copem", label: "COPEM" },
  { value: "support", label: "Équipe Support" },
];

function AdminUnitAdmins() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listUnitAdminsFn);
  const doCreate = useServerFn(createUnitAdminFn);
  const doReset = useServerFn(resetUnitAdminPasswordFn);
  const doToggle = useServerFn(toggleUnitAdminFn);
  const doDelete = useServerFn(deleteUnitAdminFn);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["unit-admins"],
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
      qc.invalidateQueries({ queryKey: ["unit-admins"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await doToggle({ data: { id, active } });
      qc.invalidateQueries({ queryKey: ["unit-admins"] });
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
      qc.invalidateQueries({ queryKey: ["unit-admins"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <p className="font-semibold">Admins d'unité (accès via /unite/login)</p>
          <p className="text-xs text-muted-foreground">
            Connexion par code d'unité + mot de passe, indépendante des comptes participants.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <ShieldPlus className="mr-1 h-4 w-4" /> Créer un admin d'unité
        </Button>
      </div>

      <Card className="mt-4">
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
                    <th className="px-3 py-2 text-left">Code de connexion</th>
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
                            onClick={() => {
                              setPwdTarget(a);
                              setPwdValue("");
                            }}
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
                Lettres, chiffres et tirets uniquement. 3 à 32 caractères. Sera stocké en majuscules.
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
    </>
  );
}
