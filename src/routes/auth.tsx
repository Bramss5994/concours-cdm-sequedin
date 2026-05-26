import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const signupSchema = z.object({
  prenom: z.string().trim().min(1, "Prénom requis").max(50),
  nom: z.string().trim().min(1, "Nom requis").max(50),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.navigate({ to: "/matches" });
  }, [user, loading, router]);

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader><CardTitle className="text-2xl">Pronos CDM 2026</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm /></TabsContent>
          </Tabs>
          <div className="mt-4 text-center text-sm">
            <Link to="/reset-password" className="text-primary hover:underline">Mot de passe oublié ?</Link>
          </div>
        </CardContent>
      </Card>
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
        const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        setBusy(false);
        if (error) toast.error(error.message);
        else { toast.success("Bienvenue !"); router.navigate({ to: "/matches" }); }
      }}
    >
      <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required autoComplete="email" /></div>
      <div className="space-y-1.5"><Label>Mot de passe</Label><Input name="password" type="password" required autoComplete="current-password" /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Connexion..." : "Se connecter"}</Button>
    </form>
  );
}

function SignupForm() {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = signupSchema.safeParse(Object.fromEntries(fd));
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { prenom: parsed.data.prenom, nom: parsed.data.nom },
          },
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("Compte créé. Vérifie ta boîte mail pour confirmer ton email.");
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Prénom</Label><Input name="prenom" required maxLength={50} /></div>
        <div className="space-y-1.5"><Label>Nom</Label><Input name="nom" required maxLength={50} /></div>
      </div>
      <div className="space-y-1.5"><Label>Email professionnel</Label><Input name="email" type="email" required autoComplete="email" /></div>
      <div className="space-y-1.5"><Label>Mot de passe</Label><Input name="password" type="password" required minLength={8} autoComplete="new-password" /><p className="text-xs text-muted-foreground">8 caractères minimum.</p></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Création..." : "Créer mon compte"}</Button>
    </form>
  );
}
