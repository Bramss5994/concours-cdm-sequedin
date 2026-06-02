import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, BarChart3, Calendar, Clock, Lock, Gift, Medal, Award } from "lucide-react";
import { useAuth } from "@/lib/auth";

import fifaWc2026 from "@/assets/fifa-wc-2026.png.asset.json";
import { Countdown } from "@/components/Countdown";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user } = useAuth();
  return (
    <div>
      <section className="relative overflow-hidden bg-[#0a0a0f]">
        {/* Stadium ambient lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(217,165,40,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(200,30,30,0.22),transparent_50%)]" />
        {/* Crowd-light specks */}
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 22%, rgba(255,210,120,0.5) 0 1px, transparent 2px), radial-gradient(circle at 78% 30%, rgba(255,230,160,0.4) 0 1px, transparent 2px), radial-gradient(circle at 32% 70%, rgba(255,180,80,0.35) 0 1px, transparent 2px), radial-gradient(circle at 88% 78%, rgba(255,220,140,0.45) 0 1px, transparent 2px), radial-gradient(circle at 55% 18%, rgba(255,200,100,0.3) 0 1px, transparent 2px)",
            backgroundSize: "320px 320px",
          }}
        />
        {/* Pitch-line glow at the bottom */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <div className="relative container mx-auto grid items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="order-2 text-center text-white lg:order-1 lg:text-left"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.8)]" />
              Sequedin · Faidherbe · Wattrelos · PC Bus
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-300/80">
              Concours de pronostics
            </p>

            <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_18px_rgba(220,38,38,0.6)] lg:mx-0" />
            <p className="mx-auto mt-6 max-w-xl text-base text-white/75 sm:text-lg lg:mx-0">
              Pronostique chaque match, grimpe au classement et joue ta place sur le podium de ton unité.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              {user ? (
                <Button asChild size="lg" className="bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_8px_30px_rgba(220,38,38,0.45)] hover:from-red-500 hover:to-red-400">
                  <Link to="/matches">Voir les matchs</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_8px_30px_rgba(220,38,38,0.45)] hover:from-red-500 hover:to-red-400">
                  <Link to="/auth">Rejoindre le concours</Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white backdrop-blur hover:bg-white/10">
                <Link to="/leaderboard">Classement</Link>
              </Button>
            </div>
          </motion.div>

          {/* Logo coupe du monde */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative order-1 flex justify-self-center lg:order-2"
          >
            <div className="absolute -inset-10 rounded-full bg-amber-400/20 blur-3xl" />
            <img
              src={fifaWc2026.url}
              alt="Concours Inter-Dépôts Coupe du Monde 2026"
              className="relative h-[32rem] w-[32rem] object-contain drop-shadow-[0_12px_40px_rgba(217,165,40,0.55)] sm:h-[48rem] sm:w-[48rem] lg:h-[64rem] lg:w-[64rem]"
            />
          </motion.div>

        </div>
      </section>

      <Countdown />

      {!user && (
        <section className="container mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-4xl text-center"
          >
            <h2 className="text-2xl font-bold sm:text-3xl">Rejoins ton dépôt</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Chaque dépôt a son propre classement et son propre podium. Inscris-toi via le lien de ton unité.
            </p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { value: "sequedin", label: "Sequedin" },
              { value: "faidherbe", label: "Faidherbe" },
              { value: "wattrelos", label: "Wattrelos" },
              { value: "pc_bus", label: "PC Bus" },
            ].map((d) => (
              <motion.div key={d.value} variants={fadeUp}>
                <Card className="group h-full border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg">
                  <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">{d.label}</h3>
                    <p className="text-xs text-muted-foreground">Classement propre à ton unité</p>
                    <Button asChild size="sm" className="mt-2 w-full">
                      <Link to="/auth" search={{ depot: d.value, tab: "signup" }}>
                        S'inscrire
                      </Link>
                    </Button>
                    <Link
                      to="/auth"
                      search={{ depot: d.value, tab: "login" }}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Déjà inscrit ? Connexion
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}


      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
        className="container mx-auto grid gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { icon: Users, t: "Entre collègues", d: "Ouvert au personnel des dépôts Sequedin, Faidherbe, Wattrelos et PC Bus." },
          { icon: Calendar, t: "Tous les matchs", d: "Phase de groupes (A à L) + 16es, 8es, quarts, demi-finales, match pour la 3e place et finale." },
          { icon: Lock, t: "Clôture à H-1", d: "Les pronos se ferment automatiquement 1h avant le coup d'envoi." },
          { icon: BarChart3, t: "Classement live", d: "Score exact = 3 pts, Vainqueur = 2 pts, match nul prédit = 1 pt." },
        ].map((c) => (
          <motion.div key={c.t} variants={fadeUp}>
            <Card className="h-full transition-shadow duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{c.t}</h3>
                <p className="text-sm text-muted-foreground">{c.d}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center text-2xl font-bold sm:text-3xl"
          >Barème des points</motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-2 text-center text-sm text-muted-foreground"
          >Pour chaque match, tes points sont attribués automatiquement à la fin de la rencontre.</motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="mt-6 grid gap-3 sm:grid-cols-3"
          >
            {[
              { cls: "border-primary/40 bg-primary/5", pts: "3 pts", t: "Score exact", desc: "Sauf le 0-0 (compte comme match nul prédit)" },
              { cls: "", pts: "2 pts", t: "Vainqueur", desc: "Tu trouves le gagnant mais pas le score exact" },
              { cls: "", pts: "1 pt", t: "Match nul prédit", desc: "Tu pronostiques un nul et le match finit nul" },
            ].map((c, i) => (
              <motion.div key={c.t} variants={fadeUp} custom={i}>
                <Card className={`h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${c.cls}`}>
                  <CardContent className="p-5 text-center">
                    <div className={`text-3xl font-extrabold ${i === 0 ? "text-primary" : ""}`}>{c.pts}</div>
                    <div className="mt-1 font-semibold">{c.t}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="mx-auto mt-12 max-w-xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-2 text-center text-2xl font-bold sm:text-3xl"
          ><Gift className="h-7 w-7 text-primary" /> Les lots</motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-2 text-center text-sm text-muted-foreground"
          >À l'issue de la finale, les 3 meilleurs pronostiqueurs de chaque unité sont récompensés :</motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6"
          >
            <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100 dark:from-amber-950/50 dark:via-orange-950/40 dark:to-amber-950/50 animate-gradient hover-lift">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center gap-1 animate-bounce-in" style={{ animationDelay: "0.2s" }}>
                    <Medal className="h-7 w-7 text-slate-500 dark:text-slate-300" />
                    <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">2e</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 animate-bounce-in" style={{ animationDelay: "0s" }}>
                    <Trophy className="h-10 w-10 text-yellow-600 dark:text-yellow-400 animate-float" />
                    <span className="text-xs font-bold uppercase text-yellow-800 dark:text-yellow-300">1er</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 animate-bounce-in" style={{ animationDelay: "0.4s" }}>
                    <Award className="h-7 w-7 text-orange-700 dark:text-orange-400" />
                    <span className="text-xs font-bold uppercase text-orange-900 dark:text-orange-300">3e</span>
                  </div>
                </div>
                <div className="mt-4 text-2xl font-extrabold text-amber-950 dark:text-amber-50">Restaurant offert</div>
                <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">pour le podium complet</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerContainer}
        className="border-t bg-muted/30"
      >
        <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
          <motion.div variants={fadeUp}>
            <h2 className="mb-3 text-2xl font-bold">Comment ça marche ?</h2>
            <p className="text-muted-foreground">3 étapes, 0 prise de tête. Que le meilleur pronostiqueur gagne !</p>
          </motion.div>
          <motion.ol variants={staggerContainer} className="md:col-span-2 space-y-4">
            {[
              ["1. Inscris-toi", "Inscris-toi avec ton numéro de paie et ton prénom, et crée ton mot de passe !"],
              ["2. Pronostique", "Saisis le score que tu prévois pour chaque match avant H-1."],
              ["3. Suis le classement", "Tes points sont calculés automatiquement après chaque match."],
            ].map(([t, d]) => (
              <motion.li key={t} variants={fadeUp} className="flex gap-3 transition-transform duration-200 hover:translate-x-1">
                <Clock className="mt-0.5 h-5 w-5 flex-none text-primary" />
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-muted-foreground">{d}</div>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </motion.section>
    </div>
  );
}
