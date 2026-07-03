import { teamNameMatches } from "./livescores.shared";

type GoalPayload = {
  player?: string | null;
  assist?: string | null;
  type?: string | null;
  api_player_id?: number | null;
  apiPlayerId?: number | null;
  side?: "a" | "b" | null;
  team?: string | null;
};

type FinishedMatchRow = {
  goalscorers: unknown;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a?: { name?: string | null } | null;
  team_b?: { name?: string | null } | null;
};

type PlayerRow = {
  id: string;
  name: string;
  team_id: string | null;
  api_player_id: number | null;
};

type Agg = {
  name: string;
  apiPlayerId: number | null;
  teamId: string | null;
  goals: number;
  assists: number;
};

export type TopScorersSyncSummary = {
  ok: true;
  aggregatedScorers: number;
  matchedDbPlayers: number;
  createdDbPlayers: number;
  resetDbPlayers: number;
  updates: { player: string; goals: number; assists: number; created: boolean }[];
  errors: string[];
  syncedAt: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sameName = (a?: string | null, b?: string | null) => Boolean(a && b && norm(a) === norm(b));

function sameTeamName(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return sameName(a, b) || teamNameMatches(b, a) || teamNameMatches(a, b);
}

function namesCompatible(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  const lastA = ta.at(-1);
  const lastB = tb.at(-1);
  if (!lastA || !lastB || lastA !== lastB) return false;

  const firstA = ta[0] || "";
  const firstB = tb[0] || "";
  return firstA[0] === firstB[0] || firstA.startsWith(firstB) || firstB.startsWith(firstA);
}

function teamIdForGoal(goal: GoalPayload, match: FinishedMatchRow): string | null {
  if (goal.side === "a") return match.team_a_id;
  if (goal.side === "b") return match.team_b_id;
  if (sameTeamName(goal.team, match.team_a?.name)) return match.team_a_id;
  if (sameTeamName(goal.team, match.team_b?.name)) return match.team_b_id;
  return null;
}

function playerApiId(goal: GoalPayload): number | null {
  return goal.api_player_id ?? goal.apiPlayerId ?? null;
}

function aggKey(name: string, apiPlayerId: number | null, teamId: string | null) {
  return apiPlayerId ? `id:${apiPlayerId}` : `n:${norm(name)}:t:${teamId ?? "unknown"}`;
}

function addAgg(map: Map<string, Agg>, input: { name: string; apiPlayerId: number | null; teamId: string | null; goals: number; assists: number }) {
  const key = aggKey(input.name, input.apiPlayerId, input.teamId);
  const cur = map.get(key) || {
    name: input.name,
    apiPlayerId: input.apiPlayerId,
    teamId: input.teamId,
    goals: 0,
    assists: 0,
  };
  cur.goals += input.goals;
  cur.assists += input.assists;
  if (!cur.apiPlayerId && input.apiPlayerId) cur.apiPlayerId = input.apiPlayerId;
  if (!cur.teamId && input.teamId) cur.teamId = input.teamId;
  map.set(key, cur);
}

export async function syncTopScorersFromFinishedMatches(supabaseAdmin: any): Promise<TopScorersSyncSummary> {
  const { data: matches, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select("goalscorers, team_a_id, team_b_id, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)")
    .eq("finished", true);
  if (matchesError) throw new Error(matchesError.message);

  const aggregated = new Map<string, Agg>();
  for (const match of (matches || []) as FinishedMatchRow[]) {
    const goals = Array.isArray(match.goalscorers) ? (match.goalscorers as GoalPayload[]) : [];
    for (const goal of goals) {
      if (!goal?.player || goal.type === "own" || goal.type === "missed") continue;
      const teamId = teamIdForGoal(goal, match);
      addAgg(aggregated, {
        name: goal.player,
        apiPlayerId: playerApiId(goal),
        teamId,
        goals: 1,
        assists: 0,
      });
      if (goal.assist) {
        addAgg(aggregated, {
          name: goal.assist,
          apiPlayerId: null,
          teamId,
          goals: 0,
          assists: 1,
        });
      }
    }
  }

  const { data: players, error: playersError } = await supabaseAdmin
    .from("players")
    .select("id, name, team_id, api_player_id");
  if (playersError) throw new Error(playersError.message);

  const byApiId = new Map<number, PlayerRow>();
  const byNameAndTeam = new Map<string, PlayerRow>();
  const byName = new Map<string, PlayerRow[]>();
  const byTeam = new Map<string, PlayerRow[]>();
  for (const player of (players || []) as PlayerRow[]) {
    if (player.api_player_id) byApiId.set(player.api_player_id, player);
    byNameAndTeam.set(`${norm(player.name)}:${player.team_id ?? "unknown"}`, player);
    const nameKey = norm(player.name);
    byName.set(nameKey, [...(byName.get(nameKey) || []), player]);
    if (player.team_id) byTeam.set(player.team_id, [...(byTeam.get(player.team_id) || []), player]);
  }

  const matchedIds = new Set<string>();
  const updates: TopScorersSyncSummary["updates"] = [];
  const errors: string[] = [];
  let createdDbPlayers = 0;

  for (const scorer of aggregated.values()) {
    const compatibleTeamPlayers = scorer.teamId
      ? (byTeam.get(scorer.teamId) || []).filter((player) => namesCompatible(player.name, scorer.name))
      : [];
    const compatibleAllPlayers = (players || []).filter((player: PlayerRow) => namesCompatible(player.name, scorer.name));
    const target =
      (scorer.apiPlayerId && byApiId.get(scorer.apiPlayerId)) ||
      (scorer.teamId && byNameAndTeam.get(`${norm(scorer.name)}:${scorer.teamId}`)) ||
      (compatibleTeamPlayers.length === 1 ? compatibleTeamPlayers[0] : undefined) ||
      (byName.get(norm(scorer.name))?.length === 1 ? byName.get(norm(scorer.name))?.[0] : undefined) ||
      (compatibleAllPlayers.length === 1 ? compatibleAllPlayers[0] : undefined);

    if (target) {
      matchedIds.add(target.id);
      const patch: { goals: number; assists: number; api_player_id?: number } = {
        goals: scorer.goals,
        assists: scorer.assists,
      };
      if (scorer.apiPlayerId && !target.api_player_id) patch.api_player_id = scorer.apiPlayerId;
      const { error } = await supabaseAdmin.from("players").update(patch).eq("id", target.id);
      if (error) errors.push(`${target.name}: ${error.message}`);
      else updates.push({ player: target.name, goals: scorer.goals, assists: scorer.assists, created: false });
      continue;
    }

    if (!scorer.teamId) {
      errors.push(`${scorer.name}: équipe introuvable sur les buts du match`);
      continue;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("players")
      .insert({
        team_id: scorer.teamId,
        name: scorer.name,
        club: null,
        position: "FW",
        goals: scorer.goals,
        assists: scorer.assists,
        api_player_id: scorer.apiPlayerId,
        is_top_scorer: false,
      })
      .select("id, name, team_id, api_player_id")
      .single();
    if (error) {
      errors.push(`${scorer.name}: ${error.message}`);
    } else if (inserted) {
      createdDbPlayers += 1;
      matchedIds.add(inserted.id);
      updates.push({ player: inserted.name, goals: scorer.goals, assists: scorer.assists, created: true });
    }
  }

  let resetDbPlayers = 0;
  let resetQuery = supabaseAdmin.from("players").update({ goals: 0, assists: 0 });
  if (matchedIds.size > 0) {
    resetQuery = resetQuery.not("id", "in", `(${[...matchedIds].join(",")})`);
  }
  const { data: resetRows, error: resetError } = await resetQuery
    .or("goals.gt.0,assists.gt.0")
    .select("id");
  if (resetError) errors.push(`reset: ${resetError.message}`);
  else resetDbPlayers = resetRows?.length ?? 0;

  return {
    ok: true,
    aggregatedScorers: aggregated.size,
    matchedDbPlayers: updates.filter((u) => !u.created).length,
    createdDbPlayers,
    resetDbPlayers,
    updates,
    errors,
    syncedAt: new Date().toISOString(),
  };
}