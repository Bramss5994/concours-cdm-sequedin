import { motion } from "framer-motion";
import { Bus } from "lucide-react";

const MESSAGE = "PRONOSTICS VERROUILLÉS 1H AVANT CHAQUE MATCH";

export function BusLockBanner() {
  return (
    <section className="container mx-auto px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-2xl"
      >
        {/* Bus stop structure */}
        <div className="relative mx-auto" style={{ maxWidth: 520 }}>
          {/* Roof */}
          <div className="relative mx-auto h-3 w-full rounded-t-md bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-md" />
          <div className="mx-auto h-1.5 w-[96%] bg-zinc-800" />

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

            {/* LED Display */}
            <div className="relative overflow-hidden rounded-sm border border-amber-500/60 bg-black py-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.9)]">
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
              {/* LED scanlines */}
              <div
                className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0 1px, transparent 1px 3px)",
                }}
              />
            </div>

            {/* Schedule placeholder rows */}
            <div className="mt-3 space-y-1.5">
              {[
                { line: "CDM", dest: "Coupe du Monde 2026", time: "EN COURS" },
                { line: "H-1", dest: "Clôture des pronostics", time: "AUTO" },
              ].map((r) => (
                <div
                  key={r.line}
                  className="flex items-center justify-between gap-2 rounded-sm bg-white/5 px-2 py-1 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-black">
                      {r.line}
                    </span>
                    <span className="text-white/80">{r.dest}</span>
                  </div>
                  <span className="font-mono text-amber-300">{r.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom rail */}
          <div className="mx-auto h-1.5 w-[96%] bg-zinc-800" />

          {/* Pole */}
          <div className="mx-auto h-10 w-3 bg-gradient-to-b from-zinc-700 to-zinc-900 sm:h-14" />
          {/* Base */}
          <div className="mx-auto -mt-1 h-2 w-20 rounded-sm bg-zinc-800 shadow-md" />
          {/* Ground shadow */}
          <div className="mx-auto mt-1 h-2 w-40 rounded-[50%] bg-black/30 blur-md" />
        </div>
      </motion.div>

    </section>
  );
}
