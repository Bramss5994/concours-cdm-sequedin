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
