import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const TARGET = new Date("2026-06-11T18:00:00-05:00").getTime();

function diff() {
  const ms = Math.max(0, TARGET - Date.now());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

export function Countdown() {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    setT(diff());
    const id = setInterval(() => setT(diff()), 1000);
    return () => clearInterval(id);
  }, []);

  const items: [string, number][] = [
    ["Jours", t.days],
    ["Heures", t.hours],
    ["Minutes", t.minutes],
    ["Secondes", t.seconds],
  ];

  return (
    <section className="container mx-auto px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#0a0a0f] via-[#141420] to-[#0a0a0f] p-6 text-center shadow-lg sm:p-8"
      >
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">
          Coup d'envoi
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
          Coupe du Monde 2026 — 11 juin
        </h2>
        <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">
          {items.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur sm:p-5"
            >
              <div className="bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-3xl font-black tabular-nums text-transparent sm:text-5xl">
                {String(value).padStart(2, "0")}
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-white/60 sm:text-xs">
                {label}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
