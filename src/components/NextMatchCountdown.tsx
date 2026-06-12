import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, MapPin } from "lucide-react";
import { getNextMatchFn } from "@/lib/stats.functions";
import { flagSrcSet, flagUrl } from "@/lib/flag";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    ms,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

function stageLabel(stage: string, group: string | null) {
  switch (stage) {
    case "group":
      return group ? `Groupe ${group}` : "Phase de groupes";
    case "r32":
      return "16es de finale";
    case "r16":
      return "8es de finale";
    case "qf":
      return "Quarts de finale";
    case "sf":
      return "Demi-finales";
    case "third":
      return "Match pour la 3e place";
    case "final":
      return "Finale";
    default:
      return stage;
  }
}

function TeamSide({
  team,
  placeholder,
  align,
}: {
  team: { name: string; code: string | null } | null;
  placeholder: string | null;
  align: "left" | "right";
}) {
  const code = team?.code ?? null;
  const name = team?.name ?? placeholder ?? "À déterminer";
  return (
    <div
      className={`flex flex-1 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      {code ? (
        <img
          src={flagUrl(code, 80)}
          srcSet={flagSrcSet(code)}
          alt={name}
          className="h-7 w-10 rounded-sm object-cover shadow-md ring-1 ring-white/20 sm:h-9 sm:w-14"
          loading="lazy"
        />
      ) : (
        <div className="flex h-7 w-10 items-center justify-center rounded-sm bg-white/10 text-[10px] text-white/50 sm:h-9 sm:w-14">
          ?
        </div>
      )}
      <span className="truncate text-sm font-bold uppercase tracking-wide text-white sm:text-base">
        {name}
      </span>
    </div>
  );
}

export function NextMatchCountdown() {
  const fetchNext = useServerFn(getNextMatchFn);
  const { data: match } = useQuery({
    queryKey: ["next-match"],
    queryFn: () => fetchNext(),
    refetchInterval: 5 * 60_000,
  });

  const kickoffMs = match ? new Date(match.kickoffAt).getTime() : 0;
  const lockMs = kickoffMs - 60 * 60 * 1000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!match) return null;

  const locked = now >= lockMs;
  const started = now >= kickoffMs;
  const target = locked ? kickoffMs : lockMs;
  const t = diff(target);

  const kickoffDate = new Date(match.kickoffAt);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(kickoffDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-3 rounded-sm border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-sm bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
          Prochain match
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
          {stageLabel(match.stage, match.groupLetter)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <TeamSide team={match.teamA} placeholder={match.teamAPlaceholder} align="left" />
        <div className="shrink-0 px-1 font-mono text-xs font-bold text-white/40">VS</div>
        <TeamSide team={match.teamB} placeholder={match.teamBPlaceholder} align="right" />
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
        <span className="capitalize">{dateLabel}</span>
        {match.stadium && (
          <>
            <span className="text-white/20">·</span>
            <MapPin className="h-3 w-3" />
            <span className="normal-case tracking-normal">{match.stadium}</span>
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        <Lock
          className={`h-3 w-3 ${locked ? "text-red-400" : "text-amber-300"}`}
        />
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            locked ? "text-red-400" : "text-amber-300/90"
          }`}
        >
          {started
            ? "Match en cours"
            : locked
              ? "Pronostics verrouillés · Coup d'envoi dans"
              : "Clôture des pronostics dans"}
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {([
          ["J", t.days],
          ["H", t.hours],
          ["M", t.minutes],
          ["S", t.seconds],
        ] as [string, number][]).map(([label, value]) => (
          <div
            key={label}
            className="rounded-sm border border-white/10 bg-black/40 py-1.5 text-center"
          >
            <div
              className={`font-mono text-base font-extrabold tabular-nums leading-none sm:text-lg ${
                locked
                  ? "text-red-300 [text-shadow:0_0_6px_rgba(248,113,113,0.7)]"
                  : "text-amber-300 [text-shadow:0_0_6px_rgba(251,191,36,0.7)]"
              }`}
            >
              {String(value).padStart(2, "0")}
            </div>
            <div className="text-[8px] font-semibold uppercase tracking-widest text-white/50">
              {label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
