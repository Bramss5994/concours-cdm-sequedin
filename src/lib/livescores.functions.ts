import { createServerFn } from "@tanstack/react-start";

export type LiveFixture = {
  /** Kickoff ISO timestamp truncated to the minute (UTC) — used as join key. */
  kickoffKey: string;
  status: string; // NS, 1H, HT, 2H, ET, BT, P, SUSP, INT, FT, AET, PEN, PST, CANC, ABD, AWD, WO, LIVE
  statusLabel: string;
  elapsed: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  teamHome: string;
  teamAway: string;
  isLive: boolean;
  isFinished: boolean;
};

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "SUSP", "INT"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

const STATUS_LABEL: Record<string, string> = {
  NS: "À venir",
  "1H": "1ère mi-temps",
  HT: "Mi-temps",
  "2H": "2ème mi-temps",
  ET: "Prolongation",
  BT: "Pause prolong.",
  P: "Tirs au but",
  SUSP: "Suspendu",
  INT: "Interrompu",
  LIVE: "En direct",
  FT: "Terminé",
  AET: "Terminé (a.p.)",
  PEN: "Terminé (t.a.b.)",
  PST: "Reporté",
  CANC: "Annulé",
  ABD: "Abandonné",
  AWD: "Forfait",
  WO: "Forfait",
};

function toKickoffKey(iso: string): string {
  // ISO with timezone offset → minute precision UTC
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

export const getLiveScores = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ fixtures: LiveFixture[]; fetchedAt: string; error: string | null }> => {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) {
      return { fixtures: [], fetchedAt: new Date().toISOString(), error: "API_FOOTBALL_KEY missing" };
    }
    try {
      // World Cup league id = 1
      const res = await fetch(
        "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
        { headers: { "x-apisports-key": key } },
      );
      if (!res.ok) {
        return { fixtures: [], fetchedAt: new Date().toISOString(), error: `API ${res.status}` };
      }
      const json = (await res.json()) as {
        response?: Array<{
          fixture: { date: string; status: { short: string; elapsed: number | null } };
          teams: { home: { name: string }; away: { name: string } };
          goals: { home: number | null; away: number | null };
        }>;
      };
      const fixtures: LiveFixture[] = (json.response || []).map((f) => {
        const short = f.fixture.status.short;
        return {
          kickoffKey: toKickoffKey(f.fixture.date),
          status: short,
          statusLabel: STATUS_LABEL[short] || short,
          elapsed: f.fixture.status.elapsed,
          scoreHome: f.goals.home,
          scoreAway: f.goals.away,
          teamHome: f.teams.home.name,
          teamAway: f.teams.away.name,
          isLive: LIVE_STATUSES.has(short),
          isFinished: FINISHED_STATUSES.has(short),
        };
      });
      return { fixtures, fetchedAt: new Date().toISOString(), error: null };
    } catch (e) {
      return { fixtures: [], fetchedAt: new Date().toISOString(), error: e instanceof Error ? e.message : "fetch error" };
    }
  },
);

export function kickoffKeyFromISO(iso: string): string {
  return toKickoffKey(iso);
}
