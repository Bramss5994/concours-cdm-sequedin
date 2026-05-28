export type Channel = { name: string; color: string };

const TF1: Channel = { name: "TF1", color: "bg-blue-600 text-white" };
const M6: Channel = { name: "M6", color: "bg-fuchsia-600 text-white" };
const BEIN: Channel = { name: "beIN Sports", color: "bg-red-600 text-white" };

export function getChannels(match: {
  stage: string;
  team_a?: { code?: string | null } | null;
  team_b?: { code?: string | null } | null;
}): Channel[] {
  const codes = [match.team_a?.code, match.team_b?.code];
  const involvesFrance = codes.includes("fr");

  // Finale, 3e place, demies, quarts, 8es : TF1 + beIN
  if (["final", "third", "sf", "qf", "r16"].includes(match.stage)) {
    return [TF1, BEIN];
  }

  // 16es : France sur TF1, sinon M6
  if (match.stage === "r32") {
    return [involvesFrance ? TF1 : M6, BEIN];
  }

  // Phase de groupes
  if (involvesFrance) return [TF1, BEIN];
  return [M6, BEIN];
}
