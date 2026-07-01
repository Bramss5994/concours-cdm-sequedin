export type LiveFixture = {
  /** Kickoff ISO timestamp truncated to the minute (UTC) — used as join key. */
  kickoffKey: string;
  apiFixtureId: number;
  status: string;
  statusLabel: string;
  elapsed: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  scoreHomeET: number | null;
  scoreAwayET: number | null;
  scoreHomePEN: number | null;
  scoreAwayPEN: number | null;
  teamHome: string;
  teamAway: string;
  isLive: boolean;
  isFinished: boolean;
};

export type GoalEvent = {
  minute: number | null;
  extra: number | null;
  team: string;
  player: string;
  apiPlayerId: number | null;
  assist: string | null;
  type: "goal" | "penalty" | "own" | "missed";
};

export type TopScorer = {
  apiPlayerId: number;
  name: string;
  team: string;
  club: string | null;
  goals: number;
  assists: number;
};

export function kickoffKeyFromISO(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export const LIVE_STATUS_LABEL: Record<string, string> = {
  NS: "À venir",
  "1H": "1ʳᵉ MT",
  HT: "Mi-temps",
  "2H": "2ᵉ MT",
  ET: "Prolong.",
  BT: "Pause prolong.",
  P: "Tirs au but",
  SUSP: "Suspendu",
  INT: "Interrompu",
  LIVE: "En direct",
  FT: "Terminé",
  AET: "Terminé (a.p.)",
  PEN: "Terminé (t.a.b.)",
};

/**
 * Alias FR → nom anglais utilisé par API-Football. Sert à associer sans
 * ambiguïté un match en base à un fixture de l'API lorsque plusieurs matchs
 * partagent le même horaire de coup d'envoi.
 */
const TEAM_ALIASES: Record<string, string[]> = {
  "ecosse": ["scotland"],
  "bresil": ["brazil"],
  "haiti": ["haiti"],
  "maroc": ["morocco"],
  "coree du sud": ["south korea", "korea republic"],
  "coree du nord": ["north korea", "korea dpr"],
  "etats unis": ["usa", "united states"],
  "pays bas": ["netherlands"],
  "allemagne": ["germany"],
  "espagne": ["spain"],
  "belgique": ["belgium"],
  "suisse": ["switzerland"],
  "croatie": ["croatia"],
  "danemark": ["denmark"],
  "angleterre": ["england"],
  "italie": ["italy"],
  "japon": ["japan"],
  "mexique": ["mexico"],
  "canada": ["canada"],
  "australie": ["australia"],
  "autriche": ["austria"],
  "jordanie": ["jordan"],
  "tunisie": ["tunisia"],
  "senegal": ["senegal"],
  "afrique du sud": ["south africa"],
  "arabie saoudite": ["saudi arabia"],
  "cote d ivoire": ["ivory coast", "cote d'ivoire"],
  "nouvelle zelande": ["new zealand"],
  "irlande": ["ireland"],
  "ecosse ": ["scotland"],
  "iran": ["iran"],
  "irak": ["iraq"],
  "qatar": ["qatar"],
  "russie": ["russia"],
  "turquie": ["turkey", "türkiye"],
  "grece": ["greece"],
  "norvege": ["norway"],
  "suede": ["sweden"],
  "portugal": ["portugal"],
  "france": ["france"],
  "argentine": ["argentina"],
  "colombie": ["colombia"],
  "uruguay": ["uruguay"],
  "paraguay": ["paraguay"],
  "equateur": ["ecuador"],
  "chili": ["chile"],
  "perou": ["peru"],
  "venezuela": ["venezuela"],
  "bolivie": ["bolivia"],
  "algerie": ["algeria"],
  "egypte": ["egypt"],
  "nigeria": ["nigeria"],
  "ghana": ["ghana"],
  "cameroun": ["cameroon"],
};

function normalizeTeam(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Teste si un nom d'équipe en base (FR) correspond à un nom d'équipe API (EN).
 */
export function teamNameMatches(dbName: string, apiName: string): boolean {
  const a = normalizeTeam(dbName);
  const b = normalizeTeam(apiName);
  if (!a || !b) return false;
  if (a === b) return true;
  const aliases = TEAM_ALIASES[a] || [];
  if (aliases.some((x) => normalizeTeam(x) === b)) return true;
  // Fallback prudent : préfixe commun d'au moins 4 lettres
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)));
}

/**
 * Retourne le fixture qui matche les DEUX équipes du match en base, sans se
 * rabattre sur "le premier" en cas d'ambiguïté (évite les mauvais imports).
 */
export function pickFixtureByTeams<T extends { teamHome: string; teamAway: string }>(
  candidates: T[],
  dbTeamA: string,
  dbTeamB: string,
): T | null {
  for (const c of candidates) {
    const aH = teamNameMatches(dbTeamA, c.teamHome);
    const bA = teamNameMatches(dbTeamB, c.teamAway);
    const aA = teamNameMatches(dbTeamA, c.teamAway);
    const bH = teamNameMatches(dbTeamB, c.teamHome);
    if ((aH && bA) || (aA && bH)) return c;
  }
  return null;
}

