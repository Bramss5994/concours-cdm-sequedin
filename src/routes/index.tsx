import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, BarChart3, Calendar, Clock, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user } = useAuth();
  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-blue-700 text-primary-foreground">
        <div className="container mx-auto px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur">
              <Trophy className="h-4 w-4" /> Dépôt de Sequedin · Keolis / Ilévia
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              Pronostics Coupe du Monde <span className="text-accent-foreground bg-accent rounded-md px-2">2026</span>
            </h1>
            <p className="mt-6 text-lg text-white/90 sm:text-xl">
              Pronostiquez tous les matchs de la Coupe du Monde, défiez vos collègues du dépôt et grimpez au classement.
              Ambiance conviviale garantie ! ⚽
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {user ? (
                <Button asChild size="lg" variant="secondary">
                  <Link to="/matches"><Calendar className="h-5 w-5" /> Faire mes pronostics</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" variant="secondary">
                    <Link to="/auth">S'inscrire</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">
                    <Link to="/auth">Se connecter</Link>
                  </Button>
                </>
              )}
              <Button asChild size="lg" variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">
                <Link to="/leaderboard"><BarChart3 className="h-5 w-5" /> Voir le classement</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, t: "Entre collègues", d: "Réservé au personnel du dépôt de Sequedin." },
          { icon: Calendar, t: "Tous les matchs", d: "Phase de groupes + 32es, 8es, quarts, demis, finale." },
          { icon: Lock, t: "Clôture à H-1", d: "Les pronos se ferment automatiquement 1h avant le coup d'envoi." },
          { icon: BarChart3, t: "Classement live", d: "Score exact = 3 pts, bon vainqueur = 2 pts." },
        ].map((c) => (
          <Card key={c.t}>
            <CardContent className="flex flex-col gap-2 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{c.t}</h3>
              <p className="text-sm text-muted-foreground">{c.d}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="border-t bg-muted/30">
        <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <h2 className="mb-3 text-2xl font-bold">Comment ça marche ?</h2>
            <p className="text-muted-foreground">3 étapes, 0 prise de tête. Que le meilleur pronostiqueur gagne !</p>
          </div>
          <ol className="md:col-span-2 space-y-4">
            {[
              ["1. Inscris-toi", "Avec ton email professionnel et un mot de passe."],
              ["2. Pronostique", "Saisis le score que tu prévois pour chaque match avant H-1."],
              ["3. Suis le classement", "Tes points sont calculés automatiquement après chaque match."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <Clock className="mt-0.5 h-5 w-5 flex-none text-primary" />
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-muted-foreground">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
