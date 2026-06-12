import { motion } from "framer-motion";
import busImg from "@/assets/sequedin-bus.png.asset.json";

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
        <motion.img
          src={busImg.url}
          alt="Bus Sequedin"
          className="relative z-0 mx-auto w-full select-none object-contain"
          initial={{ x: -40 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        {/* Destination sign (girouette) overlay — positioned over the bus front sign */}
        <div
          className="pointer-events-none absolute z-10 overflow-hidden rounded-[2px] border border-amber-500/70 bg-black shadow-[0_0_14px_rgba(251,191,36,0.5)]"
          style={{
            top: "10%",
            left: "51%",
            width: "42%",
            height: "8%",
          }}
        >
          <div className="flex h-full items-center whitespace-nowrap font-mono text-amber-300 [text-shadow:0_0_5px_rgba(251,191,36,0.95)]">
            <motion.div
              className="flex shrink-0 gap-12 px-4 text-[clamp(0.55rem,1.4vw,1rem)] font-bold tracking-[0.15em]"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            >
              <span>{MESSAGE}</span>
              <span>{MESSAGE}</span>
              <span>{MESSAGE}</span>
              <span>{MESSAGE}</span>
            </motion.div>
          </div>
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
