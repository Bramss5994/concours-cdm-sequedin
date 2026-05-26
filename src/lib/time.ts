export const LOCK_MS = 60 * 60 * 1000; // 1h before kickoff

export function isLocked(kickoff: string | Date): boolean {
  const k = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  return Date.now() >= k.getTime() - LOCK_MS;
}

export function formatFR(kickoff: string | Date): string {
  const d = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function lockMessage(kickoff: string | Date): string {
  const k = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  const close = new Date(k.getTime() - LOCK_MS);
  return `Pronostics fermés depuis le ${formatFR(close)}.`;
}

export function timeUntilLock(kickoff: string | Date): string {
  const k = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  const ms = k.getTime() - LOCK_MS - Date.now();
  if (ms <= 0) return "Fermé";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `Clôture dans ${Math.floor(h / 24)}j ${h % 24}h`;
  return `Clôture dans ${h}h${String(m).padStart(2, "0")}`;
}
