import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatFR } from "@/lib/time";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <div className="container mx-auto p-6">Connexion requise.</div>;
  if (!isAdmin) return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold">Espace admin</h1>
      <p className="mt-2 text-muted-foreground">Vous n'avez pas les droits d'administrateur.</p>
      <p className="mt-1 text-xs text-muted-foreground">Pour devenir admin, demandez à un admin existant — ou si vous êtes le premier utilisateur, demandez à ce que votre rôle soit ajouté manuellement.</p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Administration</h1>
      <Tabs defaultValue="results" className="mt-4">
        <TabsList>
          <TabsTrigger value="results">Résultats des matchs</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
        </TabsList>
        <TabsContent value="results"><AdminResults /></TabsContent>
        <TabsContent value="users"><AdminUsers /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdminResults() {
  const qc = useQueryClient();
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

  async function save(id: string, sa: number, sb: number, finished: boolean) {
    const { error } = await supabase.from("matches").update({ score_a: sa, score_b: sb, finished }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Résultat enregistré, points recalculés"); qc.invalidateQueries(); }
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

  return (
    <>
      <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div className="text-sm">
          <p className="font-semibold">Agent IA — mise à jour automatique des scores</p>
          <p className="text-xs text-muted-foreground">Synchronise les scores depuis API-Football toutes les 15 min. Tu peux aussi déclencher manuellement.</p>
        </div>
        <Button size="sm" onClick={syncNow} disabled={syncing}>
          {syncing ? "Synchro…" : "Synchroniser maintenant"}
        </Button>
      </div>
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Match</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">Validé</th><th></th></tr>
            </thead>
            <tbody>
              {matches.map((m) => <ResultRow key={m.id} m={m} onSave={save} />)}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

function ResultRow({ m, onSave }: { m: any; onSave: (id: string, sa: number, sb: number, finished: boolean) => void }) {
  const [sa, setSa] = useState<string>(m.score_a != null ? String(m.score_a) : "");
  const [sb, setSb] = useState<string>(m.score_b != null ? String(m.score_b) : "");
  const [fin, setFin] = useState<boolean>(m.finished);
  const nameA = m.team_a?.name || m.team_a_placeholder || "?";
  const nameB = m.team_b?.name || m.team_b_placeholder || "?";
  return (
    <tr className="border-t">
      <td className="px-3 py-2">{nameA} - {nameB} <span className="ml-2 text-xs text-muted-foreground uppercase">{m.stage}{m.group_letter ? ` ${m.group_letter}` : ""}</span></td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatFR(m.kickoff_at)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Input type="number" min={0} max={20} value={sa} onChange={(e) => setSa(e.target.value)} className="h-8 w-14 text-center" />
          <span>-</span>
          <Input type="number" min={0} max={20} value={sb} onChange={(e) => setSb(e.target.value)} className="h-8 w-14 text-center" />
        </div>
      </td>
      <td className="px-3 py-2 text-center"><Switch checked={fin} onCheckedChange={setFin} /></td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" onClick={() => {
          const a = Number(sa), b = Number(sb);
          if (fin && (!Number.isInteger(a) || !Number.isInteger(b))) { toast.error("Scores requis pour valider"); return; }
          onSave(m.id, a, b, fin);
        }}>Enregistrer</Button>
      </td>
    </tr>
  );
}

function AdminUsers() {
  const qc = useQueryClient();
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

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Nom</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-center">Actif</th><th className="px-3 py-2 text-center">Admin</th></tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.prenom} {u.num_paie}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2 text-center"><Switch checked={u.active} onCheckedChange={(v) => toggleActive(u.id, v)} /></td>
                  <td className="px-3 py-2 text-center"><Switch checked={u.roles.includes("admin")} onCheckedChange={(v) => toggleAdmin(u.id, v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
