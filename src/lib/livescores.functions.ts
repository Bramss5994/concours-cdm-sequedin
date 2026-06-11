import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LiveFixture = {
  /** Kickoff ISO timestamp truncated to the minute (UTC) — used as join key. */
  kickoffKey: string;
  apiFixtureId: number;
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
const LEAGUE_ID = 1; // World Cup
const SEASON = 2026;

function toKickoffKey(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

async function apiFetch(path: string): Promise<{ ok: true; json: any } | { ok: false; error: string }> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { ok: false, error: "API_FOOTBALL_KEY missing" };
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { "x-apisports-key": key } });
    if (!res.ok) return { ok: false, error: `API ${res.status}` };
    const json = await res.json();
    // API-Football returns 200 with errors in body when plan/key is wrong
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
    if (!r.ok) return { fixtures: [], fetchedAt: new Date().toISOString(), error: r.error };
    const arr = (r.json.response || []) as Array<{
      fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
      teams: { home: { name: string }; away: { name: string } };
      goals: { home: number | null; away: number | null };
    }>;
    const fixtures: LiveFixture[] = arr.map((f) => {
      const short = f.fixture.status.short;
      return {
        kickoffKey: toKickoffKey(f.fixture.date),
        apiFixtureId: f.fixture.id,
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
}

export const getLiveScores = createServerFn({ method: "GET" }).handler(fetchLiveScores);

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
    const goals: GoalEvent[] = arr
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

export const getFixtureEvents = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ fixtureId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => fetchFixtureEvents(data.fixtureId));

export async function fetchTopScorers(): Promise<{ scorers: TopScorer[]; fetchedAt: string; error: string | null }> {
    const r = await apiFetch(`/players/topscorers?league=${LEAGUE_ID}&season=${SEASON}`);
    if (!r.ok) return { scorers: [], fetchedAt: new Date().toISOString(), error: r.error };
    const arr = (r.json.response || []) as Array<{
      player: { id: number; name: string };
      statistics: Array<{
        team: { name: string };
        games?: { position?: string | null };
        goals: { total: number | null; assists: number | null };
      }>;
    }>;
    const scorers: TopScorer[] = arr.map((p) => {
      const stat = p.statistics?.[0];
      return {
        apiPlayerId: p.player.id,
        name: p.player.name,
        team: stat?.team?.name || "",
        club: null,
        goals: stat?.goals?.total ?? 0,
        assists: stat?.goals?.assists ?? 0,
      };
    });
    return { scorers, fetchedAt: new Date().toISOString(), error: null };
}

export const getTopScorers = createServerFn({ method: "GET" }).handler(fetchTopScorers);

export function kickoffKeyFromISO(iso: string): string {
  return toKickoffKey(iso);
}
