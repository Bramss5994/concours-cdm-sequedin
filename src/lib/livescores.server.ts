import { kickoffKeyFromISO, type GoalEvent, type LiveFixture } from "./livescores.shared";

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

const API_BASE = "https://v3.football.api-sports.io";
const LEAGUE_ID = 1;
const SEASON = 2026;

async function apiFetch(path: string): Promise<{ ok: true; json: any } | { ok: false; error: string }> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { ok: false, error: "API_FOOTBALL_KEY missing" };
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { "x-apisports-key": key } });
    if (!res.ok) return { ok: false, error: `API ${res.status}` };
    const json = await res.json();
    if (json && json.errors && !Array.isArray(json.errors) && Object.keys(json.errors).length > 0) {
      return { ok: false, error: `API error: ${JSON.stringify(json.errors)}` };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch error" };
  }
}

export async function fetchLiveScores(): Promise<{ fixtures: LiveFixture[]; fetchedAt: string; error: string | null }> {
  const r = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);
  return mapFixturesResponse(r);
}

/** Fetches only fixtures currently in-play. Cheaper (small payload, no quota burn). */
export async function fetchLiveOnly(): Promise<{ fixtures: LiveFixture[]; fetchedAt: string; error: string | null }> {
  const r = await apiFetch(`/fixtures?live=all&league=${LEAGUE_ID}&season=${SEASON}`);
  return mapFixturesResponse(r);
}

function mapFixturesResponse(
  r: { ok: true; json: any } | { ok: false; error: string },
): { fixtures: LiveFixture[]; fetchedAt: string; error: string | null } {
  if (!r.ok) return { fixtures: [], fetchedAt: new Date().toISOString(), error: r.error };
  const arr = (r.json.response || []) as Array<{
    fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
    teams: { home: { name: string }; away: { name: string } };
    goals: { home: number | null; away: number | null };
    score?: {
      fulltime?: { home: number | null; away: number | null } | null;
      extratime?: { home: number | null; away: number | null } | null;
      penalty?: { home: number | null; away: number | null } | null;
    };
  }>;
  const fixtures = arr.map((f) => {
    const short = f.fixture.status.short;
    // Le pronostic se joue sur les 90 min + arrêts de jeu :
    // on privilégie donc score.fulltime (temps réglementaire) sur goals (qui inclut prolongations/tab).
    const regHome = f.score?.fulltime?.home ?? f.goals.home;
    const regAway = f.score?.fulltime?.away ?? f.goals.away;
    return {
      kickoffKey: kickoffKeyFromISO(f.fixture.date),
      apiFixtureId: f.fixture.id,
      status: short,
      statusLabel: STATUS_LABEL[short] || short,
      elapsed: f.fixture.status.elapsed,
      scoreHome: regHome,
      scoreAway: regAway,
      scoreHomeET: f.score?.extratime?.home ?? null,
      scoreAwayET: f.score?.extratime?.away ?? null,
      scoreHomePEN: f.score?.penalty?.home ?? null,
      scoreAwayPEN: f.score?.penalty?.away ?? null,
      teamHome: f.teams.home.name,
      teamAway: f.teams.away.name,
      isLive: LIVE_STATUSES.has(short),
      isFinished: FINISHED_STATUSES.has(short),
    };
  });
  return { fixtures, fetchedAt: new Date().toISOString(), error: null };
}


export async function fetchFixtureEvents(fixtureId: number): Promise<{ goals: GoalEvent[]; error: string | null }> {
  const r = await apiFetch(`/fixtures/events?fixture=${fixtureId}&type=Goal`);
  if (!r.ok) return { goals: [], error: r.error };
  const arr = (r.json.response || []) as Array<{
    time: { elapsed: number | null; extra: number | null };
    team: { name: string };
    player: { id: number | null; name: string | null };
    assist: { id: number | null; name: string | null };
    type: string;
    detail: string;
  }>;
  const goals = arr
    .filter((e) => e.type === "Goal")
    .map((e) => {
      const detail = (e.detail || "").toLowerCase();
      let type: GoalEvent["type"] = "goal";
      if (detail.includes("own")) type = "own";
      else if (detail.includes("penalty")) type = detail.includes("missed") ? "missed" : "penalty";
      return {
        minute: e.time.elapsed,
        extra: e.time.extra,
        team: e.team?.name || "",
        player: e.player?.name || "Inconnu",
        apiPlayerId: e.player?.id ?? null,
        assist: e.assist?.name || null,
        type,
      };
    })
    .filter((g) => g.type !== "missed");
  return { goals, error: null };
}
