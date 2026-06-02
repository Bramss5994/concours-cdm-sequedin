import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEPOTS = [
  { value: "sequedin", label: "Sequedin" },
  { value: "faidherbe", label: "Faidherbe" },
  { value: "wattrelos", label: "Wattrelos" },
  { value: "pc_bus", label: "PC Bus" },
] as const;
type DepotValue = typeof DEPOTS[number]["value"];
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => ({
    depot: typeof search.depot === "string" ? (search.depot as string) : undefined,
    tab: search.tab === "signup" ? "signup" : "login",
  }),
});


// Build a deterministic pseudo-email from prénom + numéro de paie so Supabase Auth
// (which requires an email) accepts the account without the user typing one.
function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function buildEmail(prenom: string, numPaie: string) {
  return `${slug(prenom)}.${slug(numPaie)}@sequedin.local`;
}

const nameSchema = z.object({
  prenom: z.string().trim().min(1, "Prénom requis").max(50),
  numPaie: z.string().trim().min(1, "N° de paie requis").max(50),
  password: z.string().min(8, "8 caractères minimum").max(72),
  depot: z.enum(["sequedin", "faidherbe", "wattrelos", "pc_bus"], { message: "Dépôt requis" }),
});

const loginSchema = z.object({
  prenom: z.string().trim().min(1, "Prénom requis").max(50),
  numPaie: z.string().trim().min(1, "N° de paie requis").max(50),
  password: z.string().min(1, "Mot de passe requis"),
});

function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { depot: depotParam, tab } = Route.useSearch();
  const lockedDepot = DEPOTS.find((d) => d.value === depotParam)?.value as DepotValue | undefined;
  const lockedDepotLabel = DEPOTS.find((d) => d.value === depotParam)?.label;

  useEffect(() => {
    if (!loading && user) router.navigate({ to: "/matches" });
  }, [user, loading, router]);

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Inter-Dépôts CDM 2026</CardTitle>
          {lockedDepotLabel && (
            <p className="mt-1 text-sm text-muted-foreground">
              Espace <span className="font-semibold text-primary">{lockedDepotLabel}</span> · Connecte-toi pour pronostiquer avec ton dépôt.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={lockedDepot ? "signup" : tab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm lockedDepot={lockedDepot} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Aucune adresse e-mail n'est demandée. Utilise ton prénom et ton numéro de paie pour te connecter.
      </p>
    </div>
  );
}


function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = loginSchema.safeParse(Object.fromEntries(fd));
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setBusy(true);
        const email = buildEmail(parsed.data.prenom, parsed.data.numPaie);
        const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
        setBusy(false);
        if (error) toast.error("Identifiants invalides");
        else { toast.success("Bienvenue !"); router.navigate({ to: "/matches" }); }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Prénom</Label><Input name="prenom" required maxLength={50} autoComplete="given-name" /></div>
        <div className="space-y-1.5"><Label>N° de paie</Label><Input name="numPaie" required maxLength={50} autoComplete="off" /></div>
      </div>
      <div className="space-y-1.5"><Label>Mot de passe</Label><Input name="password" type="password" required autoComplete="current-password" /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Connexion..." : "Se connecter"}</Button>
    </form>
  );
}

function SignupForm({ lockedDepot }: { lockedDepot?: DepotValue }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [depot, setDepot] = useState<DepotValue | "">(lockedDepot ?? "");

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = nameSchema.safeParse({ ...Object.fromEntries(fd), depot });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setBusy(true);
        const email = buildEmail(parsed.data.prenom, parsed.data.numPaie);
        const { error } = await supabase.auth.signUp({
          email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { prenom: parsed.data.prenom, num_paie: parsed.data.numPaie, depot: parsed.data.depot },
          },
        });
        if (error) {
          setBusy(false);
          toast.error(error.message.includes("registered") ? "Ce prénom/nom est déjà utilisé." : error.message);
          return;
        }
        // Auto-confirm is enabled, so we can sign in immediately
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
        setBusy(false);
        if (signInError) { toast.success("Compte créé. Connecte-toi."); return; }
        toast.success("Compte créé !");
        router.navigate({ to: "/matches" });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Prénom</Label><Input name="prenom" required maxLength={50} autoComplete="given-name" /></div>
        <div className="space-y-1.5"><Label>N° de paie</Label><Input name="numPaie" required maxLength={50} autoComplete="off" /></div>
      </div>
      <div className="space-y-1.5">
        <Label>Dépôt / Unité</Label>
        <Select value={depot || undefined} onValueChange={(v) => setDepot(v as DepotValue)}>
          <SelectTrigger><SelectValue placeholder="Choisis ton unité" /></SelectTrigger>
          <SelectContent>
            {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Mot de passe</Label><Input name="password" type="password" required minLength={8} autoComplete="new-password" /><p className="text-xs text-muted-foreground">8 caractères minimum. Retiens-le bien, il n'y a pas de récupération par e-mail.</p></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Création..." : "Créer mon compte"}</Button>
      
    </form>
  );
}
