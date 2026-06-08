export type Channel = { name: string; color: string };

const M6: Channel = { name: "M6", color: "bg-fuchsia-600 text-white" };
const BEIN: Channel = { name: "beIN Sports", color: "bg-red-600 text-white" };

/**
 * Liste officielle des matchs CDM 2026 diffusés sur M6 (en clair).
 * Source : touteleurope.eu (calendrier officiel des 104 matchs).
 * Clés au format "YYYY-MM-DDTHH:MM" en UTC, dérivées du coup d'envoi
 * Paris local moins 2h (CEST, juin-juillet 2026).
 * Tous les autres matchs sont diffusés uniquement sur beIN Sports.
 */
const M6_MATCHES_UTC: ReadonlySet<string> = new Set([
  // Phase de groupes
  "2026-06-11T19:00", "2026-06-12T19:00", "2026-06-13T19:00",
  "2026-06-13T22:00", "2026-06-14T17:00", "2026-06-14T20:00",
  "2026-06-15T16:00", "2026-06-15T19:00", "2026-06-15T22:00",
  "2026-06-16T19:00", "2026-06-16T22:00", "2026-06-17T17:00",
  "2026-06-17T20:00", "2026-06-18T16:00", "2026-06-18T19:00",
  "2026-06-19T19:00", "2026-06-19T22:00", "2026-06-20T01:00",
  "2026-06-20T17:00", "2026-06-20T20:00", "2026-06-21T16:00",
  "2026-06-21T19:00", "2026-06-22T17:00", "2026-06-22T21:00",
  "2026-06-23T17:00", "2026-06-23T20:00", "2026-06-24T19:00",
  "2026-06-25T20:00", "2026-06-25T23:00", "2026-06-26T19:00",
  "2026-06-27T00:00", "2026-06-27T21:00", "2026-06-27T23:30",
  // 16es de finale
  "2026-06-28T19:00", "2026-06-29T17:00", "2026-06-29T20:30",
  "2026-06-30T17:00", "2026-06-30T21:00", "2026-07-01T16:00",
  "2026-07-02T19:00", "2026-07-03T18:00",
  // 8es de finale
  "2026-07-04T17:00", "2026-07-04T21:00", "2026-07-05T20:00",
  "2026-07-06T19:00", "2026-07-07T16:00", "2026-07-07T20:00",
  // Quarts
  "2026-07-09T20:00", "2026-07-10T19:00", "2026-07-11T21:00",
  // Demi-finales
  "2026-07-14T19:00", "2026-07-15T19:00",
  // Match pour la 3e place
  "2026-07-18T21:00",
  // Finale
  "2026-07-19T19:00",
]);

function kickoffKey(iso: string): string {
  // "2026-06-11T19:00:00+00" → "2026-06-11T19:00"
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function getChannels(match: { kickoff_at: string }): Channel[] {
  return M6_MATCHES_UTC.has(kickoffKey(match.kickoff_at)) ? [M6, BEIN] : [BEIN];
}
