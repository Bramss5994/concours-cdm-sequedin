import { motion } from "framer-motion";
import logoPcBus from "@/assets/logo-pc-bus.png.asset.json";

const MESSAGE = "PRONOSTICS VERROUILLÉS 1H AVANT CHAQUE MATCH";

export function BusLockBanner() {
  return (
    <section className="container mx-auto px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-3xl"
      >
        {/* Bus image */}
        <motion.img
          src={logoPcBus.url}
          alt="Bus PC"
          className="relative z-0 mx-auto w-full select-none object-contain"
          initial={{ x: -40 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        {/* Destination sign (girouette) overlay */}
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 overflow-hidden rounded-[3px] border border-amber-500/60 bg-black shadow-[0_0_18px_rgba(251,191,36,0.45)]"
          style={{
            top: "16%",
            width: "44%",
            height: "9%",
          }}
        >
          <div className="flex h-full items-center whitespace-nowrap font-mono text-amber-300 [text-shadow:0_0_6px_rgba(251,191,36,0.9)]">
            <motion.div
              className="flex shrink-0 gap-12 px-6 text-[clamp(0.7rem,1.8vw,1.25rem)] font-bold tracking-[0.18em]"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            >
              <span>{MESSAGE}</span>
              <span>{MESSAGE}</span>
              <span>{MESSAGE}</span>
              <span>{MESSAGE}</span>
            </motion.div>
          </div>
          {/* LED scanline */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0 1px, transparent 1px 3px)",
            }}
          />
        </div>
      </motion.div>

      <p className="mx-auto mt-4 max-w-xl text-center text-sm text-muted-foreground">
        Les pronostics se ferment automatiquement 1h avant le coup d'envoi de chaque match.
      </p>
    </section>
  );
}
