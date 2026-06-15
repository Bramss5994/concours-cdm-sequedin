import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isLocked, formatFR } from "@/lib/time";
import { toast } from "sonner";
import { Loader2, Trophy, BarChart3 } from "lucide-react";
import { flagUrl, flagSrcSet } from "@/lib/flag";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/matches")({ component: MatchesPage });

// Types complets incluant vos données enrichies
type Match = { 
  id: string; 
  kickoff_at: string; 
  stadium: string;
  api_fixture_id?: number | null;
  stage?: string;
  group_letter?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a: { name: string; code?: string } | null; 
  team_b: { name: string; code?: string } | null; 
  team_a_placeholder?: string | null;
  team_b_placeholder?: string | null;
  finished: boolean; 
  score_a: number | null; 
  score_b: number | null;
  live_status?: string | null;
  live_score_a?: number | null;
  live_score_b?: number | null;
  live_elapsed?: number | null;
  goalscorers?: Array<{
    minute: number | null;
    extra: number | null;
    team: string;
    player: string;
    api_player_id?: number | null;
    assist?: string | null;
    type?: string;
  }> | null;
};

type Prediction = { match_id: string; score_a: number; score_b: number };

type TeamStanding = {
  team_id: string;
  name: string;
  code?: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

function computeGroupStandings(matches: Match[]): Record<string, TeamStanding[]> {
  const groups: Record<string, Map<string, TeamStanding>> = {};
  for (const m of (matches || []).filter((x) => x.stage === 'group')) {
    const g = m.group_letter || "?";
    if (!groups[g]) groups[g] = new Map();
    const map = groups[g];
    function ensure(teamId: string | null, teamName?: string, code?: string | null) {
      if (!teamId) return null;
      if (!map.has(teamId)) {
        map.set(teamId, {
          team_id: teamId,
          name: teamName || "—",
          code: code || undefined,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          goal_diff: 0,
          points: 0,
        });
      }
      return map.get(teamId)!;
    }
    const a = ensure(m.team_a_id, (m.team_a as any)?.name, (m.team_a as any)?.code);
    const b = ensure(m.team_b_id, (m.team_b as any)?.name, (m.team_b as any)?.code);
    if (m.score_a == null || m.score_b == null) continue;
    a.played++; b.played++;
    a.goals_for += m.score_a; a.goals_against += m.score_b;
    b.goals_for += m.score_b; b.goals_against += m.score_a;
    if (m.score_a > m.score_b) { a.wins++; a.points += 3; b.losses++; }
    else if (m.score_a < m.score_b) { b.wins++; b.points += 3; a.losses++; }
    else { a.draws++; b.draws++; a.points++; b.points++; }
  }
  const result: Record<string, TeamStanding[]> = {};
  for (const [g, map] of Object.entries(groups)) {
    const arr = Array.from(map.values()).map((s) => ({ ...s, goal_diff: s.goals_for - s.goals_against }));
    arr.sort((x, y) => y.points - x.points || y.goal_diff - x.goal_diff || y.goals_for - x.goals_for || x.name.localeCompare(y.name));
    result[g] = arr;
  }
  return result;
}

function MatchCard({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data && data.length > 0) setStats(data[0]);
    };
    fetchStats();
  }, [match.id]);

  const locked = isLocked(match.kickoff_at);

  async function save() {
    if (!user) {
      toast.error("Connectez-vous pour enregistrer un pronostic.");
      return;
    }
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (scoreA === "" || scoreB === "" || Number.isNaN(a) || Number.isNaN(b)) {
      toast.error("Veuillez saisir les deux scores.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("predictions")
        .upsert({ user_id: user.id, match_id: match.id, score_a: a, score_b: b }, { onConflict: "user_id,match_id", returning: "representation" });
      if (error) {
        console.error("Prediction save error:", error);
        toast.error(`Erreur en enregistrant le pronostic: ${error.message}`);
      } else {
        toast.success("Pronostic enregistré");
        qc.invalidateQueries({ queryKey: ["predictions"] });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau lors de l'enregistrement du pronostic.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border-primary/20 bg-card p-4">
      {/* Effet visuel lumineux */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex justify-between text-xs text-muted-foreground mb-4">
        <span>{match.kickoff_at ? formatFR(match.kickoff_at) : "—"}</span>
        <span>{match.stadium}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col items-center gap-2">
          {match.team_a?.code ? (
            <img src={flagUrl(match.team_a.code, 40)} srcSet={flagSrcSet(match.team_a.code)} alt={match.team_a?.name || ''} className="h-8 w-12 rounded-sm object-cover" />
          ) : (
            <span className="text-3xl">{match.team_a?.name?.charAt(0) ?? "?"}</span>
          )}
          <span className="font-bold text-sm">{match.team_a?.name}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 size={12}/> Stats</span>
            <div className="flex w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${stats?.percentage_a || 50}%` }} />
                <div className="bg-accent h-full" style={{ width: `${stats?.percentage_b || 50}%` }} />
            </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          {match.team_b?.code ? (
            <img src={flagUrl(match.team_b.code, 40)} srcSet={flagSrcSet(match.team_b.code)} alt={match.team_b?.name || ''} className="h-8 w-12 rounded-sm object-cover" />
          ) : (
            <span className="text-3xl">{match.team_b?.name?.charAt(0) ?? "?"}</span>
          )}
          <span className="font-bold text-sm">{match.team_b?.name}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
         <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={busy} className="w-14 p-2 border rounded-lg text-center font-bold text-lg bg-background" />
         <span className="font-bold"> - </span>
         <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={busy} className="w-14 p-2 border rounded-lg text-center font-bold text-lg bg-background" />
         <Button onClick={save} disabled={busy} className="ml-2">OK</Button>
      </div>
    </Card>
  );
}

function MatchesPage() {
  const { user } = useAuth();
  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: async () => { const { data } = await supabase.from("matches").select("*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*)"); return data as Match[]; } });
  const { data: predictions = [] } = useQuery({ queryKey: ["predictions", user?.id], enabled: !!user, queryFn: async () => { const { data } = await supabase.from("predictions").select("*").eq("user_id", user!.id); return data as Prediction[]; } });

  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]));
  const groupStandings = computeGroupStandings(matches as Match[]);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="text-primary h-8 w-8" />
        <h1 className="text-3xl font-extrabold tracking-tight">Pronos Coupe du Monde 2026</h1>
      </div>

      {/* Section: Matchs en cours */}
      {(() => {
        const now = Date.now();
        const liveMatches = (matches as Match[]).filter((m) => {
          try {
            const kickoff = new Date(m.kickoff_at).getTime();
            const within2h = kickoff <= now && now <= kickoff + 2 * 60 * 60 * 1000;
            return (!m.finished && (m.live_status && m.live_status !== 'NS')) || (!m.finished && within2h);
          } catch {
            return false;
          }
        });
        if (liveMatches.length === 0) return null;
        return (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Matchs en cours</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liveMatches.map((lm) => (
                <Card key={lm.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {lm.team_a?.code && <img src={flagUrl(lm.team_a.code, 40)} alt="" className="h-6 w-8 rounded-sm object-cover" />}
                      <div className="font-medium truncate">{lm.team_a?.name || lm.team_a_placeholder}</div>
                    </div>
                    <div className="font-bold text-lg">
                      { (lm.live_score_a != null && lm.live_score_b != null) ? `${lm.live_score_a}-${lm.live_score_b}` : (lm.score_a != null && lm.score_b != null ? `${lm.score_a}-${lm.score_b}` : 'vs') }
                    </div>
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <div className="font-medium truncate text-right">{lm.team_b?.name || lm.team_b_placeholder}</div>
                      {lm.team_b?.code && <img src={flagUrl(lm.team_b.code, 40)} alt="" className="h-6 w-8 rounded-sm object-cover" />}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex justify-between">
                    <div>{lm.kickoff_at ? formatFR(lm.kickoff_at) : '—'}</div>
                    <div>{lm.live_elapsed ? `${lm.live_elapsed}'` : (lm.live_status || 'En cours')}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })()}

      {(() => {
        const groupLetters = Object.keys(computeGroupStandings(matches as Match[])).sort();
        if (groupLetters.length === 0) return null;
        const tabs = ['all', ...groupLetters];
        return (
          <div className="mb-6">
            <Tabs defaultValue="all" className="mb-6">
              <TabsList className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <TabsTrigger key={t} value={t}>{t === 'all' ? 'Tous' : `Groupe ${t === '?' ? 'Non attribué' : t}`}</TabsTrigger>
                ))}
              </TabsList>

              {tabs.map((t) => (
                <TabsContent key={t} value={t}>
                  {t === 'all' ? (
                    <div className="space-y-4">
                      {groupLetters.map((g) => (
                        <div key={g}>
                          <h3 className="font-semibold mb-2">Groupe {g === '?' ? 'Non attribué' : g}</h3>
                          <div className="space-y-2 mb-4">
                            {(matches as Match[])
                              .filter((mm) => (mm.group_letter || "?") === g)
                              .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
                              .map((mm) => (
                                <div key={mm.id} className="flex items-center justify-between rounded-md border bg-white/80 p-3">
                                  <div className="text-xs text-muted-foreground w-40">{mm.kickoff_at ? formatFR(mm.kickoff_at) : '—'}</div>
                                  <div className="flex items-center gap-2 min-w-0">
                                    {mm.team_a?.code && <img src={flagUrl(mm.team_a.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                    <div className="truncate font-medium">{mm.team_a?.name || mm.team_a_placeholder || '—'}</div>
                                  </div>
                                  <div className="font-bold">{mm.finished && mm.score_a != null && mm.score_b != null ? `${mm.score_a}-${mm.score_b}` : 'vs'}</div>
                                  <div className="flex items-center gap-2 min-w-0 justify-end">
                                    <div className="truncate text-right font-medium">{mm.team_b?.name || mm.team_b_placeholder || '—'}</div>
                                    {mm.team_b?.code && <img src={flagUrl(mm.team_b.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="overflow-x-auto rounded-lg border bg-card p-3 mb-4">
                        <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground">
                            <tr>
                              <th className="px-2 py-1">#</th>
                              <th className="px-2 py-1 text-left">Équipe</th>
                              <th className="px-2 py-1 text-center">P</th>
                              <th className="px-2 py-1 text-center">W</th>
                              <th className="px-2 py-1 text-center">D</th>
                              <th className="px-2 py-1 text-center">L</th>
                              <th className="px-2 py-1 text-center">GF</th>
                              <th className="px-2 py-1 text-center">GA</th>
                              <th className="px-2 py-1 text-center">+/-</th>
                              <th className="px-2 py-1 text-center">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupStandings[t].map((tt, idx) => (
                              <tr key={tt.team_id} className="border-t">
                                <td className="px-2 py-1">{idx + 1}</td>
                                <td className="px-2 py-1 flex items-center gap-2">
                                  {tt.code && <img src={flagUrl(tt.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                  <span>{tt.name}</span>
                                </td>
                                <td className="px-2 py-1 text-center">{tt.played}</td>
                                <td className="px-2 py-1 text-center">{tt.wins}</td>
                                <td className="px-2 py-1 text-center">{tt.draws}</td>
                                <td className="px-2 py-1 text-center">{tt.losses}</td>
                                <td className="px-2 py-1 text-center">{tt.goals_for}</td>
                                <td className="px-2 py-1 text-center">{tt.goals_against}</td>
                                <td className="px-2 py-1 text-center">{tt.goal_diff}</td>
                                <td className="px-2 py-1 text-center font-bold">{tt.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Liste des matchs du groupe (anciens + à venir) */}
                      <div className="space-y-2">
                        {(matches as Match[])
                          .filter((mm) => (mm.group_letter || "?") === t)
                          .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
                          .map((mm) => (
                            <div key={mm.id} className="flex items-center justify-between rounded-md border bg-white/80 p-3">
                              <div className="text-xs text-muted-foreground w-40">{mm.kickoff_at ? formatFR(mm.kickoff_at) : '—'}</div>
                              <div className="flex items-center gap-2 min-w-0">
                                {mm.team_a?.code && <img src={flagUrl(mm.team_a.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                <div className="truncate font-medium">{mm.team_a?.name || mm.team_a_placeholder || '—'}</div>
                              </div>
                              <div className="font-bold">{mm.finished && mm.score_a != null && mm.score_b != null ? `${mm.score_a}-${mm.score_b}` : 'vs'}</div>
                              <div className="flex items-center gap-2 min-w-0 justify-end">
                                <div className="truncate text-right font-medium">{mm.team_b?.name || mm.team_b_placeholder || '—'}</div>
                                {mm.team_b?.code && <img src={flagUrl(mm.team_b.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        );
      })()}

      {/* Upcoming matches grouped: separate group stage and knockout/other stages */}
      {(() => {
        const upcoming = (matches as Match[])
          .filter((m) => !m.finished && !isLocked(m.kickoff_at))
          .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

        const groupMatches = upcoming.filter((m) => m.stage === 'group');
        const knockoutMatches = upcoming.filter((m) => m.stage && m.stage !== 'group');
        const otherMatches = upcoming.filter((m) => !m.stage);

        const groupsByLetter: Record<string, Match[]> = {};
        for (const m of groupMatches) {
          const g = m.group_letter || "?";
          if (!groupsByLetter[g]) groupsByLetter[g] = [];
          groupsByLetter[g].push(m);
        }

        const stagesByKey: Record<string, Match[]> = {};
        for (const m of knockoutMatches) {
          const s = m.stage || 'other';
          if (!stagesByKey[s]) stagesByKey[s] = [];
          stagesByKey[s].push(m);
        }

        const groupLetters = Object.keys(groupsByLetter).sort();
        const stageOrder = ['r32','r16','r8','qf','sf','third','final'];
        const stageKeys = Object.keys(stagesByKey).sort((a, b) => {
          const ia = stageOrder.indexOf(a);
          const ib = stageOrder.indexOf(b);
          if (ia === -1 && ib === -1) return a.localeCompare(b);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });

        if (groupLetters.length === 0 && stageKeys.length === 0 && otherMatches.length === 0) return null;

        const stageLabels: Record<string, string> = {
          r32: "Seizièmes de finale",
          r16: "Huitièmes de finale",
          r8: "Quarts de finale",
          qf: "Quarts de finale",
          sf: "Demi-finales",
          third: "Match pour la 3ᵉ place",
          final: "Finale",
        };

        return (
          <div className="space-y-6">
            {/* Group stage sections - header + matchdays (compact list like the provided design) */}
                {groupLetters.map((g) => {
                  const teams = (groupStandings[g] || []).map((t) => ({ name: t.name, code: t.code }));
                  // group matches by matchday
                  const matchesOfGroup = (matches as Match[])
                    .filter((mm) => mm.stage === 'group' && (mm.group_letter || '?') === g)
                    .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0) || new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
                  const byMatchday: Record<number, Match[]> = {};
                  for (const mm of matchesOfGroup) {
                    const day = mm.matchday ?? 0;
                    if (!byMatchday[day]) byMatchday[day] = [];
                    byMatchday[day].push(mm);
                  }

                  return (
                    <section key={`group-${g}`} aria-labelledby={`group-${g}`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-3">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center text-2xl font-extrabold">{g}</div>
                          <div>
                            <h3 id={`group-${g}`} className="text-lg font-semibold">Groupe {g === '?' ? 'Divers' : g}</h3>
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {teams.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 bg-muted/20 rounded-full px-3 py-1 text-sm">
                                  {t.code && <img src={flagUrl(t.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                  <span className="font-medium truncate max-w-[140px]">{t.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground hidden md:block">Matchdays</div>
                      </div>

                      {/* Matchday list */}
                      <div className="space-y-4">
                        {Object.keys(byMatchday).map((k) => {
                          const dayNum = Number(k);
                          const mdMatches = byMatchday[dayNum];
                          return (
                            <div key={`md-${g}-${k}`} className="">
                              <div className="inline-block bg-card rounded-full px-3 py-1 text-xs font-bold mb-2">Journée {dayNum}</div>
                              <div className="grid gap-2">
                                {mdMatches.map((mm) => (
                                  <div key={mm.id} className="flex items-center justify-between rounded-lg border bg-white/80 p-2 md:p-3">
                                    <div className="text-xs text-muted-foreground w-28 hidden sm:block">{mm.kickoff_at ? formatFR(mm.kickoff_at) : '—'}</div>
                                    <div className="flex items-center gap-3 min-w-0">
                                      {mm.team_a?.code && <img src={flagUrl(mm.team_a.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                      <div className="truncate font-medium">{mm.team_a?.name || mm.team_a_placeholder || '—'}</div>
                                    </div>

                                    <div className="font-bold">{mm.finished && mm.score_a != null && mm.score_b != null ? `${mm.score_a}-${mm.score_b}` : 'vs'}</div>

                                    <div className="flex items-center gap-3 min-w-0 justify-end">
                                      <div className="truncate text-right font-medium">{mm.team_b?.name || mm.team_b_placeholder || '—'}</div>
                                      {mm.team_b?.code && <img src={flagUrl(mm.team_b.code, 20)} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                                    </div>

                                    <div className="text-xs text-muted-foreground w-32 text-right hidden md:block">{mm.stadium}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}

            {/* Knockout / Final stages */}
            {stageKeys.length > 0 && (
              <section aria-labelledby="knockout-title">
                <h3 id="knockout-title" className="text-lg font-semibold mb-2">Phase finale</h3>
                {stageKeys.map((sk) => (
                  <div key={`stage-${sk}`} className="mb-4">
                    <h4 className="text-sm font-medium mb-2">{stageLabels[sk] || sk}</h4>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {stagesByKey[sk].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()).map((mm) => (
                        <article key={mm.id} className="rounded-xl border bg-card p-3 shadow-sm transform-gpu will-change-transform transition-transform duration-300 hover:scale-105 hover:-rotate-1 hover:shadow-2xl" style={{ perspective: 800 }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {mm.team_a?.code && <img src={flagUrl(mm.team_a.code, 40)} alt={mm.team_a?.name || ''} className="h-6 w-8 rounded-sm object-cover" />}
                              <div className="truncate text-sm font-medium">{mm.team_a?.name || mm.team_a_placeholder || '—'}</div>
                            </div>

                            <div className="text-center">
                              <div className="text-xs text-muted-foreground hidden sm:block">{mm.kickoff_at ? formatFR(mm.kickoff_at) : '—'}</div>
                              <div className="font-bold text-lg">{mm.finished && mm.score_a != null && mm.score_b != null ? `${mm.score_a}-${mm.score_b}` : 'vs'}</div>
                            </div>

                            <div className="flex items-center gap-2 min-w-0 justify-end">
                              <div className="truncate text-sm font-medium text-right">{mm.team_b?.name || mm.team_b_placeholder || '—'}</div>
                              {mm.team_b?.code && <img src={flagUrl(mm.team_b.code, 40)} alt={mm.team_b?.name || ''} className="h-6 w-8 rounded-sm object-cover" />}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <div className="truncate sm:hidden">{mm.kickoff_at ? formatFR(mm.kickoff_at) : '—'}</div>
                            <div className="truncate text-right w-2/3 sm:w-auto hidden md:block">{mm.stadium}</div>
                            <div className="ml-2 text-right">{mm.live_elapsed ? `${mm.live_elapsed}'` : (mm.live_status || '')}</div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Other matches with no stage */}
            {otherMatches.length > 0 && (
              <section aria-labelledby="other-title">
                <h3 id="other-title" className="text-lg font-semibold mb-2">Autres rencontres</h3>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {otherMatches.map((mm) => (
                    <article key={mm.id} className="rounded-xl border bg-card p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="truncate">{mm.team_a?.name || mm.team_a_placeholder || '—'}</div>
                        <div className="font-bold">{mm.finished && mm.score_a != null && mm.score_b != null ? `${mm.score_a}-${mm.score_b}` : 'vs'}</div>
                        <div className="truncate text-right">{mm.team_b?.name || mm.team_b_placeholder || '—'}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      })()}
    </div>
  );
}