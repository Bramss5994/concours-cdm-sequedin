import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPwd });

function ResetPwd() {
  const [isRecovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setRecovery(true);
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader><CardTitle>{isRecovery ? "Nouveau mot de passe" : "Mot de passe oublié"}</CardTitle></CardHeader>
        <CardContent>
          {isRecovery ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const pwd = String(fd.get("password") || "");
                if (pwd.length < 8) { toast.error("8 caractères minimum"); return; }
                setBusy(true);
                const { error } = await supabase.auth.updateUser({ password: pwd });
                setBusy(false);
                if (error) toast.error(error.message);
                else { toast.success("Mot de passe mis à jour"); window.location.href = "/"; }
              }}
            >
              <div className="space-y-1.5"><Label>Nouveau mot de passe</Label><Input name="password" type="password" required minLength={8} /></div>
              <Button disabled={busy} className="w-full">{busy ? "..." : "Mettre à jour"}</Button>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const email = String(fd.get("email") || "");
                setBusy(true);
                const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                setBusy(false);
                if (error) toast.error(error.message);
                else toast.success("Email envoyé. Consulte ta boîte mail.");
              }}
            >
              <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
              <Button disabled={busy} className="w-full">{busy ? "..." : "Envoyer le lien"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
