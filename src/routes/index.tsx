import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, BarChart3, Calendar, Clock, Lock, Gift, Medal, Award } from "lucide-react";
import { useAuth } from "@/lib/auth";
import wcBanner from "@/assets/wc-banner.jpg";
import wcLogo from "@/assets/wc-logo.png";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user } = useAuth();
  return (
    <div>
      <section className="relative overflow-hidden text-primary-foreground">
        <img
          src={wcBanner}
          alt="Coupe du Monde 2026"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/70 to-blue-900/85" />
        <div className="relative container mx-auto px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <img
              src={wcLogo}
              alt="Logo Pronostics Coupe du Monde 2026"
              width={160}
              height={160}
              className="mx-auto mb-6 h-32 w-auto drop-shadow-2xl sm:h-40"
            />
            <h1 className="text-balance text-4xl font-extrabold tracking-tight drop-shadow-lg sm:text-6xl">
              Pronostics Coupe du Monde <span className="text-accent-foreground bg-accent rounded-md px-2">2026</span>
            </h1>
            <p className="mt-6 text-lg text-white/90 drop-shadow sm:text-xl">
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
          { icon: Calendar, t: "Tous les matchs", d: "Phase de groupes (A à L) + 16es, 8es, quarts, demi-finales, match pour la 3e place et finale." },
          { icon: Lock, t: "Clôture à H-1", d: "Les pronos se ferment automatiquement 1h avant le coup d'envoi." },
          { icon: BarChart3, t: "Classement live", d: "Score exact = 3 pts, bon vainqueur = 2 pts, match nul prédit = 1 pt." },
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

      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Barème des points</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">Pour chaque match, tes points sont attribués automatiquement à la fin de la rencontre.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-5 text-center">
                <div className="text-3xl font-extrabold text-primary">3 pts</div>
                <div className="mt-1 font-semibold">Score exact</div>
                <p className="mt-1 text-xs text-muted-foreground">Sauf le 0-0 (compte comme match nul prédit)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-3xl font-extrabold">2 pts</div>
                <div className="mt-1 font-semibold">Bon vainqueur</div>
                <p className="mt-1 text-xs text-muted-foreground">Tu trouves le gagnant mais pas le score exact</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-3xl font-extrabold">1 pt</div>
                <div className="mt-1 font-semibold">Match nul prédit</div>
                <p className="mt-1 text-xs text-muted-foreground">Tu pronostiques un nul et le match finit nul</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <h2 className="flex items-center justify-center gap-2 text-center text-2xl font-bold sm:text-3xl"><Gift className="h-7 w-7 text-primary" /> Les lots en chèques cadeaux</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">À l'issue de la finale, les 3 meilleurs pronostiqueurs du dépôt remportent :</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/40 dark:to-amber-900/30">
              <CardContent className="p-5 text-center">
                <Trophy className="mx-auto h-8 w-8 text-yellow-600" />
                <div className="mt-2 text-sm font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">1<sup>er</sup></div>
                <div className="mt-1 text-3xl font-extrabold">100 €</div>
                <p className="mt-1 text-xs text-muted-foreground">en chèques cadeaux</p>
              </CardContent>
            </Card>
            <Card className="border-slate-400/50 bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900/40 dark:to-slate-800/40">
              <CardContent className="p-5 text-center">
                <Medal className="mx-auto h-8 w-8 text-slate-500" />
                <div className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">2<sup>e</sup></div>
                <div className="mt-1 text-3xl font-extrabold">70 €</div>
                <p className="mt-1 text-xs text-muted-foreground">en chèques cadeaux</p>
              </CardContent>
            </Card>
            <Card className="border-orange-700/40 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20">
              <CardContent className="p-5 text-center">
                <Award className="mx-auto h-8 w-8 text-orange-700" />
                <div className="mt-2 text-sm font-bold uppercase tracking-wide text-orange-800 dark:text-orange-400">3<sup>e</sup></div>
                <div className="mt-1 text-3xl font-extrabold">40 €</div>
                <p className="mt-1 text-xs text-muted-foreground">en chèques cadeaux</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <h2 className="mb-3 text-2xl font-bold">Comment ça marche ?</h2>
            <p className="text-muted-foreground">3 étapes, 0 prise de tête. Que le meilleur pronostiqueur gagne !</p>
          </div>
          <ol className="md:col-span-2 space-y-4">
            {[
              ["1. Inscris-toi", "Inscris-toi avec ton numéro de paie et ton prénom, et crée ton mot de passe !"],
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
