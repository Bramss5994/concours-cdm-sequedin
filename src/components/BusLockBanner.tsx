import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bus, Users, ClipboardList, Activity, Calendar, Radio } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getParticipationStatsFn } from "@/lib/stats.functions";
import { NextMatchCountdown } from "@/components/NextMatchCountdown";

const MESSAGES = [
  "PRONOSTICS VERROUILLÉS 1H AVANT CHAQUE MATCH",
  "FIFA WORLD CUP 26 · TENTEZ LE SCORE EXACT POUR +3 PTS",
  "RDV SUR L'APP POUR PRONOSTIQUER LE PROCHAIN MATCH",
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function BusLockBanner() {
  const fetchStats = useServerFn(getParticipationStatsFn);
  const { data } = useQuery({
    queryKey: ["participation-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  const now = useClock();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const blink = now.getSeconds() % 2 === 0;

  const stats = [
    { icon: Users, label: "Inscrits", value: data?.totalUsers ?? "—" },
    { icon: Calendar, label: "Matchs joués", value: data ? `${data.matchesPlayed}/${data.matchesTotal}` : "—" },
    { icon: ClipboardList, label: "Pronostics", value: data?.totalPredictions ?? "—" },
    { icon: Activity, label: "Actifs", value: data ? `${data.usersWithPredictions}/${data.totalUsers}` : "—" },
  ];

  return (
    <section className="container mx-auto px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-2xl"
      >
        {/* Scène nocturne urbaine */}
        <div className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#05050d] via-[#0a0e1f] to-[#0a0a0f] px-4 pb-2 pt-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:px-8 sm:pt-12">
          {/* Halo lampadaire */}
          <div className="pointer-events-none absolute -top-10 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-300/20 blur-3xl" />
          {/* Lune */}
          <div className="pointer-events-none absolute right-6 top-4 h-8 w-8 rounded-full bg-gradient-to-br from-amber-100/80 to-amber-200/30 shadow-[0_0_30px_rgba(254,243,199,0.4)]" />

          {/* Étoiles */}
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at 12% 22%, rgba(255,255,255,0.6) 0 1px, transparent 2px), radial-gradient(circle at 78% 14%, rgba(255,255,255,0.5) 0 1px, transparent 2px), radial-gradient(circle at 32% 8%, rgba(255,255,255,0.4) 0 1px, transparent 2px), radial-gradient(circle at 88% 30%, rgba(255,255,255,0.45) 0 1px, transparent 2px), radial-gradient(circle at 55% 18%, rgba(255,255,255,0.35) 0 1px, transparent 2px), radial-gradient(circle at 22% 35%, rgba(255,255,255,0.3) 0 1px, transparent 2px)",
              backgroundSize: "420px 220px",
            }}
          />

          {/* Skyline avec fenêtres allumées */}
          <div className="pointer-events-none absolute inset-x-0 bottom-10 h-24 opacity-80">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, transparent 0%, transparent 30%, #0a0a14 30%, #0a0a14 100%)",
                maskImage:
                  "linear-gradient(to right, #000 0 8%, transparent 8% 10%, #000 10% 16%, transparent 16% 18%, #000 18% 28%, transparent 28% 30%, #000 30% 42%, transparent 42% 44%, #000 44% 56%, transparent 56% 58%, #000 58% 70%, transparent 70% 72%, #000 72% 88%, transparent 88% 90%, #000 90% 100%)",
                WebkitMaskImage:
                  "linear-gradient(to right, #000 0 8%, transparent 8% 10%, #000 10% 16%, transparent 16% 18%, #000 18% 28%, transparent 28% 30%, #000 30% 42%, transparent 42% 44%, #000 44% 56%, transparent 56% 58%, #000 58% 70%, transparent 70% 72%, #000 72% 88%, transparent 88% 90%, #000 90% 100%)",
              }}
            />
            {/* Fenêtres allumées */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 4% 70%, rgba(251,191,36,0.6) 0 1.5px, transparent 2.5px), radial-gradient(circle at 13% 80%, rgba(251,191,36,0.5) 0 1.5px, transparent 2.5px), radial-gradient(circle at 21% 75%, rgba(186,230,253,0.5) 0 1.5px, transparent 2.5px), radial-gradient(circle at 35% 78%, rgba(251,191,36,0.6) 0 1.5px, transparent 2.5px), radial-gradient(circle at 49% 72%, rgba(186,230,253,0.4) 0 1.5px, transparent 2.5px), radial-gradient(circle at 62% 82%, rgba(251,191,36,0.55) 0 1.5px, transparent 2.5px), radial-gradient(circle at 76% 76%, rgba(186,230,253,0.5) 0 1.5px, transparent 2.5px), radial-gradient(circle at 92% 78%, rgba(251,191,36,0.6) 0 1.5px, transparent 2.5px)",
                backgroundSize: "100% 100%",
              }}
            />
          </div>

          {/* Bus stop structure */}
          <div className="relative mx-auto" style={{ maxWidth: 520 }}>
            {/* Roof avec néon */}
            <div className="relative mx-auto h-3 w-full rounded-t-md bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-md" />
            <motion.div
              className="mx-auto h-[3px] w-[96%] bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-300 shadow-[0_0_14px_rgba(56,189,248,0.9)]"
              animate={{ opacity: [1, 0.4, 1, 0.85, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.1, 0.12, 0.18, 1] }}
            />

            {/* Sign panel */}
            <div className="relative mx-auto w-full overflow-hidden border-x-4 border-zinc-800 bg-gradient-to-b from-[#0a0a0f] via-[#141420] to-[#0a0a0f] p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
              {/* Header style Ilévia */}
              <div className="mb-2 flex items-center justify-between gap-2 rounded-sm bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-3 py-1.5 text-white shadow-md ring-1 ring-red-400/40">
                <div className="flex items-center gap-2">
                  <Bus className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    Info Voyageurs
                  </span>
                  <span className="hidden items-center gap-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest sm:inline-flex">
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-red-300"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                    En direct
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold tabular-nums">
                  <span>{hh}</span>
                  <span className={blink ? "opacity-100" : "opacity-30"}>:</span>
                  <span>{mm}</span>
                  <span className="hidden text-white/70 sm:inline">:</span>
                  <span className="hidden text-white/70 sm:inline">{ss}</span>
                </div>
              </div>

              {/* LED Display avec néon clignotant */}
              <motion.div
                className="relative overflow-hidden rounded-sm border border-amber-500/60 bg-black py-3"
                animate={{
                  boxShadow: [
                    "inset 0 0 18px rgba(0,0,0,0.9), 0 0 12px rgba(251,191,36,0.5)",
                    "inset 0 0 18px rgba(0,0,0,0.9), 0 0 22px rgba(251,191,36,0.85)",
                    "inset 0 0 18px rgba(0,0,0,0.9), 0 0 6px rgba(251,191,36,0.25)",
                    "inset 0 0 18px rgba(0,0,0,0.9), 0 0 20px rgba(251,191,36,0.8)",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center whitespace-nowrap font-mono text-amber-300 [text-shadow:0_0_6px_rgba(251,191,36,0.95)]">
                  <motion.div
                    className="flex shrink-0 gap-12 px-6 text-base font-bold tracking-[0.18em] sm:text-xl"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
                  >
                    {[...MESSAGES, ...MESSAGES].map((m, i) => (
                      <span key={i} className="flex items-center gap-12">
                        <span>{m}</span>
                        <span className="text-amber-500/60">●</span>
                      </span>
                    ))}
                  </motion.div>
                </div>
                {/* LED dot-matrix */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgba(0,0,0,0.55) 1px, transparent 1.5px)",
                    backgroundSize: "3px 3px",
                  }}
                />
                {/* Scanline qui passe */}
                <motion.div
                  className="pointer-events-none absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ["-20%", "120%"] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>

              {/* Prochain match + compte à rebours */}
              <NextMatchCountdown />

              {/* Stats */}
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {stats.map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={{ y: -2, scale: 1.03 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                    className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-sm border border-amber-300/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-1 py-2 text-center backdrop-blur-sm"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
                    <s.icon className="h-3.5 w-3.5 text-amber-300" />
                    <div className="font-mono text-base font-extrabold leading-none text-amber-300 [text-shadow:0_0_5px_rgba(251,191,36,0.7)] sm:text-lg">
                      {s.value}
                    </div>
                    <div className="text-[9px] font-semibold uppercase tracking-widest text-white/60">
                      {s.label}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Bandeau ligne / opérateur */}
              <div className="mt-2 flex items-center justify-between gap-2 rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/60">
                <span className="flex items-center gap-1.5">
                  <Radio className="h-3 w-3 text-cyan-300" />
                  <span>Ligne CDM26</span>
                  <span className="rounded-sm bg-cyan-400/20 px-1 py-px text-cyan-200">A</span>
                </span>
                <span>Kéolis · Ilévia</span>
              </div>
            </div>

            {/* Bottom rail */}
            <div className="mx-auto h-1.5 w-[96%] bg-zinc-800" />

            {/* Pole */}
            <div className="mx-auto h-10 w-3 bg-gradient-to-b from-zinc-700 to-zinc-900 sm:h-14" />
            {/* Base */}
            <div className="mx-auto -mt-1 h-2 w-20 rounded-sm bg-zinc-800 shadow-md" />
            {/* Trottoir mouillé */}
            <div className="mx-auto mt-1 h-3 w-56 rounded-[50%] bg-gradient-to-b from-cyan-400/20 to-transparent blur-md" />
            <div className="mx-auto h-[2px] w-72 rounded-[50%] bg-amber-300/20 blur-sm" />
          </div>

          {/* Bus qui passe en arrière-plan */}
          <motion.div
            className="pointer-events-none absolute bottom-8 left-0 z-0"
            initial={{ x: "-30%" }}
            animate={{ x: "calc(100vw + 30%)" }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear", delay: 4 }}
          >
            <div className="relative h-6 w-20 opacity-50">
              {/* Caisse */}
              <div className="absolute inset-0 rounded-md bg-gradient-to-b from-red-600 to-red-800 shadow-[0_4px_12px_rgba(220,38,38,0.4)]" />
              {/* Fenêtres */}
              <div className="absolute inset-x-1.5 top-1 h-2 rounded-sm bg-gradient-to-b from-sky-200/70 to-sky-400/40" />
              {/* Phare */}
              <motion.div
                className="absolute right-0 top-2 h-1.5 w-1.5 rounded-full bg-amber-100 shadow-[0_0_10px_rgba(254,243,199,1)]"
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              {/* Roues */}
              <div className="absolute -bottom-1 left-2 h-2 w-2 rounded-full bg-zinc-900 ring-1 ring-zinc-700" />
              <div className="absolute -bottom-1 right-2 h-2 w-2 rounded-full bg-zinc-900 ring-1 ring-zinc-700" />
            </div>
          </motion.div>

          {/* Sol */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
