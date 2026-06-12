import { motion } from "framer-motion";
import { Bus, Users, ClipboardList, Activity, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getParticipationStatsFn } from "@/lib/stats.functions";
import { NextMatchCountdown } from "@/components/NextMatchCountdown";


const MESSAGE = "PRONOSTICS VERROUILLÉS 1H AVANT CHAQUE MATCH";

export function BusLockBanner() {
  const fetchStats = useServerFn(getParticipationStatsFn);
  const { data } = useQuery({
    queryKey: ["participation-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  const stats = [
    { icon: Users, label: "Inscrits", value: data?.totalUsers ?? "—" },
    {
      icon: Calendar,
      label: "Matchs joués",
      value: data ? `${data.matchesPlayed}/${data.matchesTotal}` : "—",
    },
    { icon: ClipboardList, label: "Pronostics", value: data?.totalPredictions ?? "—" },
    {
      icon: Activity,
      label: "Actifs",
      value: data ? `${data.usersWithPredictions}/${data.totalUsers}` : "—",
    },
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
          <div className="pointer-events-none absolute -top-10 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-300/15 blur-3xl" />
          {/* Étoiles */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 12% 22%, rgba(255,255,255,0.5) 0 1px, transparent 2px), radial-gradient(circle at 78% 14%, rgba(255,255,255,0.45) 0 1px, transparent 2px), radial-gradient(circle at 32% 8%, rgba(255,255,255,0.35) 0 1px, transparent 2px), radial-gradient(circle at 88% 30%, rgba(255,255,255,0.4) 0 1px, transparent 2px), radial-gradient(circle at 55% 18%, rgba(255,255,255,0.3) 0 1px, transparent 2px)",
              backgroundSize: "420px 220px",
            }}
          />

          {/* Skyline */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-10 h-20 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(180deg, transparent 0%, transparent 30%, #0a0a14 30%, #0a0a14 100%)",
              maskImage:
                "linear-gradient(to right, #000 0 8%, transparent 8% 10%, #000 10% 16%, transparent 16% 18%, #000 18% 28%, transparent 28% 30%, #000 30% 42%, transparent 42% 44%, #000 44% 56%, transparent 56% 58%, #000 58% 70%, transparent 70% 72%, #000 72% 88%, transparent 88% 90%, #000 90% 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, #000 0 8%, transparent 8% 10%, #000 10% 16%, transparent 16% 18%, #000 18% 28%, transparent 28% 30%, #000 30% 42%, transparent 42% 44%, #000 44% 56%, transparent 56% 58%, #000 58% 70%, transparent 70% 72%, #000 72% 88%, transparent 88% 90%, #000 90% 100%)",
            }}
          />



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
              {/* Header */}
              <div className="mb-2 flex items-center justify-between gap-2 rounded-sm bg-red-600 px-3 py-1.5 text-white shadow">
                <div className="flex items-center gap-2">
                  <Bus className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    Info Voyageurs
                  </span>
                </div>
                <span className="hidden text-[10px] font-medium uppercase tracking-widest opacity-90 sm:inline">
                  Kéolis · Ilévia
                </span>
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
                    className="flex shrink-0 gap-16 px-6 text-base font-bold tracking-[0.18em] sm:text-xl"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                  >
                    <span>{MESSAGE}</span>
                    <span>{MESSAGE}</span>
                    <span>{MESSAGE}</span>
                    <span>{MESSAGE}</span>
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

              {/* Stats */}
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {stats.map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={{ y: -2, scale: 1.03 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                    className="flex flex-col items-center justify-center gap-1 rounded-sm border border-white/10 bg-white/5 px-1 py-2 text-center backdrop-blur-sm"
                  >
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


          {/* Sol */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
