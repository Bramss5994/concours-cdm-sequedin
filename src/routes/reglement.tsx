import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Gift, Lock, Calendar, Users, ShieldCheck, ScrollText, Target, Clock } from "lucide-react";

export const Route = createFileRoute("/reglement")({
  head: () => ({
    meta: [
      { title: "Règlement du concours — Pronostics CDM 2026 Keolis Lille Ilévia" },
      { name: "description", content: "Modalités du concours interne de pronostics Coupe du Monde 2026 et remise des lots pour le podium de chaque unité Keolis Lille Ilévia." },
      { property: "og:title", content: "Règlement du concours — Pronostics CDM 2026" },
      { property: "og:description", content: "Toutes les règles du concours interne de pronostics et la remise des lots aux podiums de chaque unité." },
    ],
  }),
  component: ReglementPage,
});

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {children}
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

function ReglementPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 text-center"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <ScrollText className="h-3.5 w-3.5" /> Règlement officiel
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Règlement du concours
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Concours interne de pronostics — Coupe du Monde FIFA 2026 réservé aux
          collaborateurs Keolis Lille Ilévia.
        </p>
      </motion.div>

      <Section icon={Users} title="1. Qui peut participer ?">
        <p>
          Le concours est ouvert exclusivement aux collaborateurs Keolis Lille
          Ilévia, toutes unités confondues : Sequedin, Faidherbe, Tram,
          Wattrelos, PC Bus, COPEM et Support.
        </p>
        <p>
          La participation est gratuite, individuelle et nominative.
          Chaque collaborateur ne peut créer qu'un seul compte (prénom + numéro
          de paie) et doit choisir son unité de rattachement au moment de
          l'inscription.
        </p>
      </Section>

      <Section icon={Calendar} title="2. Déroulé du concours">
        <p>
          Le concours couvre l'intégralité de la Coupe du Monde FIFA 2026 :
          phase de groupes, huitièmes, quarts, demi-finales, match pour la 3ᵉ
          place et finale.
        </p>
        <p>
          Les inscriptions sont ouvertes dès maintenant et restent possibles
          jusqu'au coup d'envoi du premier match de la compétition.
        </p>
      </Section>

      <Section icon={Target} title="3. Comment pronostiquer ?">
        <p>Pour chaque rencontre, vous pronostiquez le score exact des deux équipes.</p>
        <p>Deux pronostics « bonus » à long terme sont également proposés :</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>L'équipe gagnante de la Coupe du Monde 2026</li>
          <li>Le Soulier d'Or (meilleur buteur de la compétition)</li>
        </ul>
      </Section>

      <Section icon={Clock} title="4. Verrouillage des pronostics">
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Chaque pronostic de match est verrouillé 1 heure avant le coup d'envoi</span> de la rencontre. Passé ce délai, plus aucune création ni modification n'est possible pour ce match.
          </span>
        </div>
        <p>
          Le pronostic « équipe gagnante de la Coupe du Monde » est verrouillé
          dès le premier match de la compétition. Le pronostic « Soulier d'Or »
          suit la même règle.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Un pronostic non saisi au moins 1 h avant le coup d'envoi rapporte 0 point.</span>
        </div>
      </Section>

      <Section icon={BarePoints} title="5. Barème des points">
        <ul className="ml-5 list-disc space-y-1">
          <li><span className="font-semibold text-foreground">Score exact</span> : 3 points</li>
          <li><span className="font-semibold text-foreground">Bonne équipe gagnante (ou match nul) + bon écart</span> : 2 points</li>
          <li><span className="font-semibold text-foreground">Bonne équipe gagnante (ou match nul) seule</span> : 1 point</li>
          <li><span className="font-semibold text-foreground">Mauvais pronostic</span> : 0 point</li>
        </ul>
        <p>
          Bonus longue durée : des points additionnels sont attribués si vous
          avez correctement pronostiqué l'équipe gagnante finale de la Coupe du
          Monde et/ou le Soulier d'Or.
        </p>
        <p>
          Les classements sont mis à jour automatiquement après chaque match.
          Tout calcul de points est effectué côté serveur : les scores ne sont
          jamais saisis ni modifiables par les participants.
        </p>
      </Section>


      <Section icon={ShieldCheck} title="6. Classements">
        <p>
          Deux classements sont publiés en temps réel sur le site :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Le <span className="font-semibold text-foreground">classement général</span>, tous collaborateurs confondus.</li>
          <li>Le <span className="font-semibold text-foreground">classement par unité</span>, qui détermine le podium de chaque dépôt.</li>
        </ul>
        <p>
          En cas d'égalité de points en fin de concours, les participants sont
          départagés successivement par : nombre de scores exacts, puis nombre
          de bonnes équipes gagnantes, puis date la plus précoce d'inscription.

        </p>
      </Section>

      <Section icon={Gift} title="7. Lots et remise des prix">
        <p>
          <span className="font-semibold text-foreground">Des lots sont à gagner pour le podium de chaque unité</span>
          {" "}(1ᵉʳ, 2ᵉ et 3ᵉ). La nature exacte des lots est définie par
          l'organisation et communiquée à l'issue de la compétition.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 text-center">
            <Trophy className="mx-auto h-8 w-8 text-yellow-500" />
            <div className="mt-2 text-sm font-bold">1ᵉʳ de l'unité</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <Medal className="mx-auto h-8 w-8 text-slate-400" />
            <div className="mt-2 text-sm font-bold">2ᵉ de l'unité</div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <Award className="mx-auto h-8 w-8 text-orange-500" />
            <div className="mt-2 text-sm font-bold">3ᵉ de l'unité</div>
          </div>
        </div>
        <p>
          La remise des lots est organisée au sein de chaque unité, dans les
          semaines qui suivent la finale de la Coupe du Monde, sur la base du
          classement final figé après le dernier match.
        </p>
        <p>
          Les lots ne sont ni cessibles, ni échangeables, ni remboursables.
          Pour pouvoir prétendre à un lot, le gagnant doit toujours être
          collaborateur Keolis Lille Ilévia au moment de la remise.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="8. Données personnelles & fair-play">
        <p>
          Les informations collectées (prénom, numéro de paie, unité) sont
          utilisées uniquement dans le cadre du concours et ne sont pas
          transmises à des tiers.
        </p>
        <p>
          Toute tentative de fraude (comptes multiples, usage du numéro de paie
          d'un autre collaborateur, contournement des règles) entraîne la
          disqualification immédiate et sans appel.
        </p>
        <p>
          L'organisation se réserve le droit de modifier le règlement en cas de
          force majeure ou d'ajustement nécessaire au bon déroulement du
          concours, en informant les participants via le site.
        </p>
      </Section>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link to="/auth">S'inscrire au concours</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/matches">Voir les matchs</Link>
        </Button>
      </div>
    </div>
  );
}

// Local icon alias to avoid extra import noise
function BarePoints(props: any) {
  return <Trophy {...props} />;
}
