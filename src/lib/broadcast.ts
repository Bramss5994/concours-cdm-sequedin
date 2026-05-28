export type Channel = { name: string; color: string };

const M6: Channel = { name: "M6", color: "bg-fuchsia-600 text-white" };
const BEIN: Channel = { name: "beIN Sports", color: "bg-red-600 text-white" };

// Affiches de poules confirmées sur M6 (liste officielle partielle)
// Paires de codes équipes (ordre indifférent)
const M6_GROUP_MATCHES: ReadonlySet<string> = new Set([
  "mx|za", // Match d'ouverture
  "cz|za",
  "ba|ca",
  "ch|qa",
  "ba|ch",
  "br|ma",
]);

function pairKey(a?: string | null, b?: string | null): string {
  return [a ?? "", b ?? ""].sort().join("|");
}

export function getChannels(match: {
  stage: string;
  team_a?: { code?: string | null } | null;
  team_b?: { code?: string | null } | null;
}): Channel[] {
  const a = match.team_a?.code ?? null;
  const b = match.team_b?.code ?? null;
  const involvesFrance = a === "fr" || b === "fr";

  // Finale, petite finale, demi-finales, quarts : M6 + beIN
  if (["final", "third", "sf", "qf"].includes(match.stage)) {
    return [M6, BEIN];
  }

  // 8es de finale : M6 + beIN
  if (match.stage === "r16") {
    return [M6, BEIN];
  }

  // 16es de finale : M6 + beIN (tous diffusés par M6)
  if (match.stage === "r32") {
    return [M6, BEIN];
  }

  // Phase de groupes
  // Matchs de la France : M6 + beIN
  if (involvesFrance) return [M6, BEIN];

  // Affiches confirmées sur M6
  if (M6_GROUP_MATCHES.has(pairKey(a, b))) {
    return [M6, BEIN];
  }

  // Autres matchs de poules : seulement beIN (non diffusés par M6)
  return [BEIN];
}
