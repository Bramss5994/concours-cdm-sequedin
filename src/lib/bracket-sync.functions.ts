import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireUnitAdmin, SUPER_ADMIN_DEPOT } from "./unit-admin.functions";
import { kickoffKeyFromISO } from "./livescores.shared";
import { z } from "zod";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data: roleData, error: e1 } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!roleData) throw new Error("Forbidden: admin required");
  const { data: prof, error: e2 } = await supabase
    .from("profiles")
    .select("depot")
    .eq("id", userId)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!prof || prof.depot !== "sequedin") {
    throw new Error("Forbidden: super-admin (Sequedin) requis");
  }
}

// Alias EN/variants → nom FR exact présent dans `teams.name`
const NAME_ALIASES: Record<string, string> = {
  "south africa": "Afrique du Sud",
  algeria: "Algérie",
  germany: "Allemagne",
  england: "Angleterre",
  "saudi arabia": "Arabie Saoudite",
  argentina: "Argentine",
  australia: "Australie",
  austria: "Autriche",
  belgium: "Belgique",
  "bosnia and herzegovina": "Bosnie-Herzégovine",
  "bosnia & herzegovina": "Bosnie-Herzégovine",
  brazil: "Brésil",
  canada: "Canada",
  "cape verde": "Cap-Vert",
  "cabo verde": "Cap-Vert",
  colombia: "Colombie",
  "south korea": "Corée du Sud",
  "korea republic": "Corée du Sud",
  "ivory coast": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  croatia: "Croatie",
  curacao: "Curaçao",
  scotland: "Écosse",
  egypt: "Égypte",
  ecuador: "Équateur",
  spain: "Espagne",
  "united states": "États-Unis",
  usa: "États-Unis",
  france: "France",
  ghana: "Ghana",
  haiti: "Haïti",
  iraq: "Irak",
  iran: "Iran",
  "ir iran": "Iran",
  japan: "Japon",
  jordan: "Jordanie",
  morocco: "Maroc",
  mexico: "Mexique",
  norway: "Norvège",
  "new zealand": "Nouvelle-Zélande",
  uzbekistan: "Ouzbékistan",
  panama: "Panamá",
  paraguay: "Paraguay",
  netherlands: "Pays-Bas",
  portugal: "Portugal",
  qatar: "Qatar",
  senegal: "Sénégal",
  switzerland: "Suisse",
  tunisia: "Tunisie",
  turkey: "Turquie",
  uruguay: "Uruguay",
  venezuela: "Venezuela",
  italy: "Italie",
  denmark: "Danemark",
  poland: "Pologne",
  sweden: "Suède",
  serbia: "Serbie",
  ukraine: "Ukraine",
  "czech republic": "Tchéquie",
  czechia: "Tchéquie",
  "republic of ireland": "Irlande",
  ireland: "Irlande",
  "northern ireland": "Irlande du Nord",
  wales: "Pays de Galles",
  greece: "Grèce",
  finland: "Finlande",
  hungary: "Hongrie",
  romania: "Roumanie",
  bulgaria: "Bulgarie",
  albania: "Albanie",
  georgia: "Géorgie",
  slovakia: "Slovaquie",
  slovenia: "Slovénie",
  iceland: "Islande",
  nigeria: "Nigeria",
  cameroon: "Cameroun",
  congo: "Congo",
  "dr congo": "RD Congo",
  zambia: "Zambie",
  angola: "Angola",
  mali: "Mali",
  "burkina faso": "Burkina Faso",
  benin: "Bénin",
  gabon: "Gabon",
  togo: "Togo",
  comoros: "Comores",
  chile: "Chili",
  peru: "Pérou",
  bolivia: "Bolivie",
  costarica: "Costa Rica",
  "costa rica": "Costa Rica",
  honduras: "Honduras",
  jamaica: "Jamaïque",
  guatemala: "Guatemala",
  "el salvador": "Salvador",
  "trinidad and tobago": "Trinité-et-Tobago",
  china: "Chine",
  "china pr": "Chine",
  india: "Inde",
  thailand: "Thaïlande",
  vietnam: "Vietnam",
  indonesia: "Indonésie",
  malaysia: "Malaisie",
  philippines: "Philippines",
  "united arab emirates": "Émirats arabes unis",
  uae: "Émirats arabes unis",
  oman: "Oman",
  bahrain: "Bahreïn",
  kuwait: "Koweït",
  lebanon: "Liban",
  palestine: "Palestine",
  syria: "Syrie",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function runSyncBracketTeams() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchLiveScores } = await import("./livescores.server");

  const live = await fetchLiveScores();
  if (live.error) {
    return { ok: false, error: live.error, updated: 0, details: [] as any[] };
  }

  const { data: teams, error: teamsErr } = await supabaseAdmin
    .from("teams")
    .select("id, name");
  if (teamsErr) return { ok: false, error: teamsErr.message, updated: 0, details: [] };

  const teamByNorm = new Map<string, string>();
  for (const t of teams || []) teamByNorm.set(normalize(t.name), t.id);

  const findTeamId = (apiName: string): string | null => {
    const norm = normalize(apiName);
    if (teamByNorm.has(norm)) return teamByNorm.get(norm)!;
    const aliasFr = NAME_ALIASES[norm];
    if (aliasFr) {
      const id = teamByNorm.get(normalize(aliasFr));
      if (id) return id;
    }
    for (const [n, id] of teamByNorm) {
      if (n.startsWith(norm) || norm.startsWith(n)) return id;
    }
    return null;
  };

  const { data: koMatches, error: koErr } = await supabaseAdmin
    .from("matches")
    .select("id, stage, kickoff_at, api_fixture_id, team_a_id, team_b_id, team_a_placeholder, team_b_placeholder")
    .in("stage", ["r32", "r16", "qf", "sf", "third", "final"]);
  if (koErr) return { ok: false, error: koErr.message, updated: 0, details: [] };

  const byKickoff = new Map<string, typeof live.fixtures>();
  const byFixtureId = new Map<number, typeof live.fixtures[number]>();
  for (const f of live.fixtures) {
    const arr = byKickoff.get(f.kickoffKey) || [];
    arr.push(f);
    byKickoff.set(f.kickoffKey, arr);
    byFixtureId.set(f.apiFixtureId, f);
  }

  const details: any[] = [];
  const errors: string[] = [];
  let updated = 0;

  for (const m of koMatches || []) {
    if (m.team_a_id && m.team_b_id) continue;
    let fixture = m.api_fixture_id ? byFixtureId.get(m.api_fixture_id) : null;
    if (!fixture) {
      const cands = byKickoff.get(kickoffKeyFromISO(m.kickoff_at)) || [];
      if (cands.length === 1) fixture = cands[0];
    }
    if (!fixture) continue;
    if (fixture.teamHome.toLowerCase().includes("tbd") || fixture.teamAway.toLowerCase().includes("tbd")) continue;

    const homeId = findTeamId(fixture.teamHome);
    const awayId = findTeamId(fixture.teamAway);

    const patch: Record<string, any> = {};
    if (!m.team_a_id && homeId) patch.team_a_id = homeId;
    if (!m.team_b_id && awayId) patch.team_b_id = awayId;
    if (!m.api_fixture_id) patch.api_fixture_id = fixture.apiFixtureId;

    if (Object.keys(patch).length === 0) {
      if (!homeId) errors.push(`Équipe inconnue: "${fixture.teamHome}" (slot ${m.team_a_placeholder})`);
      if (!awayId) errors.push(`Équipe inconnue: "${fixture.teamAway}" (slot ${m.team_b_placeholder})`);
      continue;
    }

    const { error: e } = await supabaseAdmin.from("matches").update(patch as any).eq("id", m.id);
    if (e) {
      errors.push(`${m.stage} ${m.team_a_placeholder} vs ${m.team_b_placeholder}: ${e.message}`);
      continue;
    }
    updated += 1;
    details.push({
      stage: m.stage,
      slot: `${m.team_a_placeholder} vs ${m.team_b_placeholder}`,
      home: fixture.teamHome,
      away: fixture.teamAway,
      homeMatched: !!homeId,
      awayMatched: !!awayId,
    });
  }

  return { ok: true, updated, details, errors, checkedFixtures: live.fixtures.length };
}

async function runBackfillGoalscorers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchFixtureEvents, fetchLiveScores } = await import("./livescores.server");

  const { data: matches, error } = await supabaseAdmin
    .from("matches")
    .select("id, api_fixture_id, score_a, score_b, goalscorers, kickoff_at")
    .eq("finished", true)
    .order("kickoff_at", { ascending: false });
  if (error) return { ok: false, error: error.message, processed: 0, updated: 0, errors: [] as string[] };

  const live = await fetchLiveScores();
  const fixtureMap = new Map<number, { home: string; away: string }>();
  for (const f of live.fixtures) {
    fixtureMap.set(f.apiFixtureId, { home: f.teamHome, away: f.teamAway });
  }

  const MAX_PER_RUN = 6;
  const DELAY_MS = 1500;
  const updates: any[] = [];
  const errors: string[] = [];
  let processed = 0;

  for (const m of matches || []) {
    const hasGoals = Array.isArray(m.goalscorers) && (m.goalscorers as any[]).length > 0;
    const expectedGoals = (m.score_a ?? 0) + (m.score_b ?? 0);
    if (hasGoals || expectedGoals === 0 || !m.api_fixture_id) continue;
    if (processed >= MAX_PER_RUN) {
      errors.push(`${m.id}: reporté (limite ${MAX_PER_RUN}/run)`);
      continue;
    }
    processed += 1;
    if (processed > 1) await new Promise((r) => setTimeout(r, DELAY_MS));
    const ev = await fetchFixtureEvents(m.api_fixture_id);
    if (ev.error) {
      errors.push(`${m.id}: ${ev.error}`);
      continue;
    }
    const fx = fixtureMap.get(m.api_fixture_id);
    const payload = dedupeGoals(
      ev.goals.map((g) => ({
        minute: g.minute,
        extra: g.extra,
        team: g.team,
        player: g.player,
        api_player_id: g.apiPlayerId,
        assist: g.assist,
        type: g.type,
        side: sideOfGoal(g.team, fx),
      })),
    );
    const { error: e } = await supabaseAdmin
      .from("matches")
      .update({ goalscorers: payload } as any)
      .eq("id", m.id);
    if (e) {
      errors.push(`${m.id}: ${e.message}`);
      continue;
    }
    updates.push({ id: m.id, count: payload.length });
  }

  return { ok: true, processed, updated: updates.length, details: updates, errors };
}

export function sideOfGoal(team: string, fx?: { home: string; away: string }): "home" | "away" | null {
  if (!fx) return null;
  const t = normalize(team);
  const h = normalize(fx.home);
  const a = normalize(fx.away);
  if (t === h) return "home";
  if (t === a) return "away";
  if (h.startsWith(t) || t.startsWith(h)) return "home";
  if (a.startsWith(t) || t.startsWith(a)) return "away";
  return null;
}

export function dedupeGoals<T extends { minute: number | null; extra: number | null; player: string; team: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const g of arr) {
    const key = `${g.minute ?? "x"}|${g.extra ?? "x"}|${normalize(g.player)}|${normalize(g.team)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

export const syncBracketTeamsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return runSyncBracketTeams();
  });

export const backfillGoalscorersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return runBackfillGoalscorers();
  });

// Variants accessibles via la session cookie super-admin (panel /unite/gestion)
export const syncBracketTeamsAsUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    return runSyncBracketTeams();
  });

export const backfillGoalscorersAsUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    return runBackfillGoalscorers();
  });


const KO_STAGES = ["r16", "qf", "sf", "third", "final"] as const;

export const listKoMatchesAsUnitAdminFn = createServerFn({ method: "GET" })
  .middleware([requireUnitAdmin])
  .handler(async ({ context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: matches, error: e1 }, { data: teams, error: e2 }] = await Promise.all([
      supabaseAdmin
        .from("matches")
        .select(
          "id, stage, kickoff_at, team_a_id, team_b_id, team_a_placeholder, team_b_placeholder",
        )
        .in("stage", KO_STAGES as unknown as ("r16"|"qf"|"sf"|"third"|"final")[])
        .order("kickoff_at", { ascending: true }),
      supabaseAdmin.from("teams").select("id, name, code").order("name"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { matches: matches ?? [], teams: teams ?? [] };
  });

export const assignKoTeamsAsUnitAdminFn = createServerFn({ method: "POST" })
  .middleware([requireUnitAdmin])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        team_a_id: z.string().uuid().nullable(),
        team_b_id: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (context.depot !== SUPER_ADMIN_DEPOT) throw new Error("Forbidden: super admin requis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("matches")
      .update({ team_a_id: data.team_a_id, team_b_id: data.team_b_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
