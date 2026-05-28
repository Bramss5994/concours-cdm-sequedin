import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, BarChart3, Calendar, Clock, Lock, Gift, Medal, Award } from "lucide-react";
import { useAuth } from "@/lib/auth";
import logoConcours from "@/assets/logo-concours-transparent.png";

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

        <div className="relative container mx-auto grid items-center gap-10 px-4 py-20 sm:py-28 lg:grid-cols-[1.4fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.8)]" />
              Dépôt de Sequedin
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-300/80">
              Concours de pronostics
            </p>
            <h1 className="mt-2 font-black uppercase leading-[0.95] tracking-tight">
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                Coupe
              </span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(217,165,40,0.35)]">
                du Monde
              </span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-white">
                2026
              </span>
            </h1>
            <div className="mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_18px_rgba(220,38,38,0.6)]" />
            <p className="mt-6 max-w-xl text-base text-white/75 sm:text-lg">
              Pronostique chaque match, grimpe au classement et joue ta place sur le podium du dépôt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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

          {/* Logo concours */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden justify-self-center lg:flex"
          >
            <div className="absolute -inset-10 rounded-full bg-amber-400/20 blur-3xl" />
            <img
              src={logoConcours}
              alt="Logo CDM Pronos — Keolis Lille Ilévia"
              className="relative h-96 w-96 object-contain drop-shadow-[0_12px_40px_rgba(217,165,40,0.45)]"
            />
          </motion.div>
        </div>
      </section>

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
        className="container mx-auto grid gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { icon: Users, t: "Entre collègues", d: "Réservé au personnel du dépôt de Sequedin." },
          { icon: Calendar, t: "Tous les matchs", d: "Phase de groupes (A à L) + 16es, 8es, quarts, demi-finales, match pour la 3e place et finale." },
          { icon: Lock, t: "Clôture à H-1", d: "Les pronos se ferment automatiquement 1h avant le coup d'envoi." },
          { icon: BarChart3, t: "Classement live", d: "Score exact = 3 pts, bon vainqueur = 2 pts, match nul prédit = 1 pt." },
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
              { cls: "", pts: "2 pts", t: "Bon vainqueur", desc: "Tu trouves le gagnant mais pas le score exact" },
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

        <div className="mx-auto mt-12 max-w-4xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-2 text-center text-2xl font-bold sm:text-3xl"
          ><Gift className="h-7 w-7 text-primary" /> Les lots en chèques cadeaux</motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-2 text-center text-sm text-muted-foreground"
          >À l'issue de la finale, les 3 meilleurs pronostiqueurs du dépôt remportent :</motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="mt-6 grid gap-3 sm:grid-cols-3"
          >
            {[
              { cls: "border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/40 dark:to-amber-900/30", icon: Trophy, iconColor: "text-yellow-600", rank: "1er", rankColor: "text-yellow-700 dark:text-yellow-400", amount: "100 €" },
              { cls: "border-slate-400/50 bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900/40 dark:to-slate-800/40", icon: Medal, iconColor: "text-slate-500", rank: "2e", rankColor: "text-slate-600 dark:text-slate-300", amount: "70 €" },
              { cls: "border-orange-700/40 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20", icon: Award, iconColor: "text-orange-700", rank: "3e", rankColor: "text-orange-800 dark:text-orange-400", amount: "40 €" },
            ].map((c) => (
              <motion.div key={c.rank} variants={fadeUp}>
                <Card className={`h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${c.cls}`}>
                  <CardContent className="p-5 text-center">
                    <c.icon className={`mx-auto h-8 w-8 ${c.iconColor}`} />
                    <div className={`mt-2 text-sm font-bold uppercase tracking-wide ${c.rankColor}`}>{c.rank}</div>
                    <div className="mt-1 text-3xl font-extrabold">{c.amount}</div>
                    <p className="mt-1 text-xs text-muted-foreground">en chèques cadeaux</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
