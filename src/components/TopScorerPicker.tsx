import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Goal, Lock, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

type Player = {
  id: string;
  name: string;
  position: string;
  club: string | null;
  team_id: string;
  is_top_scorer: boolean;
  goals: number;
  assists: number;
};
type Team = { id: string; code: string; name: string };

const POS_LABEL: Record<string, string> = { GK: "Gardien", DF: "Défenseur", MF: "Milieu", FW: "Attaquant" };

export function TopScorerPicker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string | undefined>();

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, position, club, team_id, is_top_scorer, goals, assists")
        .order("name");
      return (data || []) as Player[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["ts-teams"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, code, name").order("name");
      return (data || []) as Team[];
    },
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["ts-matches"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("kickoff_at");
      return data || [];
    },
  });

  const { data: pick } = useQuery({
    queryKey: ["top-scorer-prediction", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("top_scorer_predictions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-created", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("created_at").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const EXTENDED_DEADLINE = new Date("2026-06-19T00:00:00Z").getTime();
  const extendedOpen = Date.now() < EXTENDED_DEADLINE;
  const isNewUser = !!profile?.created_at && new Date(profile.created_at).getTime() >= new Date("2026-06-12T00:00:00Z").getTime();
  const firstKick = useMemo(() => {
    return matches.reduce<string | null>(
      (acc: string | null, m: any) => (acc === null || m.kickoff_at < acc ? m.kickoff_at : acc),
      null,
    );
  }, [matches]);
  const open = extendedOpen || isNewUser || !firstKick || Date.now() < new Date(firstKick).getTime();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter((p) => {
        const team = teamById.get(p.team_id);
        return (
          p.name.toLowerCase().includes(q) ||
          (p.club || "").toLowerCase().includes(q) ||
          (team?.name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [players, search, teamById]);

  const pickedPlayer = pick ? players.find((p) => p.id === pick.player_id) : null;
  const topScorer = players.find((p) => p.is_top_scorer) || null;

  const liveRanking = useMemo(
    () =>
      [...players]
        .filter((p) => p.goals > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name))
        .slice(0, 10),
    [players],
  );

  const save = useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase
        .from("top_scorer_predictions")
        .upsert({ user_id: user!.id, player_id: playerId }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["top-scorer-prediction"] });
      setDraft(undefined);
      setSearch("");
      toast.success("Meilleur buteur enregistré !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) return null;

  return (
    <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-background to-background">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Goal className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold">Mon pronostic Soulier d'Or</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez le joueur qui sera meilleur buteur de la Coupe du Monde 2026.
          +10 pts bonus si vous trouvez juste. Verrouillé dès le coup d'envoi du 1er match.
        </p>

        {pickedPlayer && (
          <div className="mt-3 rounded-md border bg-card/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mon choix</div>
              {open ? (
                <Badge variant="secondary" className="text-xs">Modifiable</Badge>
              ) : (
                <Badge variant="outline" className="text-xs"><Lock className="mr-1 h-3 w-3" />Verrouillé</Badge>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {teamById.get(pickedPlayer.team_id) && (
                <img
                  src={`https://flagcdn.com/w40/${teamById.get(pickedPlayer.team_id)!.code}.png`}
                  alt=""
                  className="h-5 w-7 rounded-sm object-cover ring-1 ring-border"
                />
              )}
              <div>
                <div className="font-medium">{pickedPlayer.name}</div>
                <div className="text-xs text-muted-foreground">
                  {POS_LABEL[pickedPlayer.position]} · {teamById.get(pickedPlayer.team_id)?.name}
                  {pickedPlayer.club ? ` · ${pickedPlayer.club}` : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {open && (
          <div className="mt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un joueur (nom, club, sélection)…"
                className="pl-9"
              />
            </div>
            {search.trim().length > 0 && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-md border bg-card">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Aucun joueur trouvé.</p>
                ) : (
                  <ul className="divide-y">
                    {filtered.map((p) => {
                      const team = teamById.get(p.team_id);
                      const isDraft = draft === p.id;
                      return (
                        <li
                          key={p.id}
                          onClick={() => setDraft(p.id)}
                          className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${isDraft ? "bg-emerald-500/10" : ""}`}
                        >
                          {team && (
                            <img
                              src={`https://flagcdn.com/w20/${team.code}.png`}
                              alt=""
                              className="h-4 w-6 rounded-sm object-cover ring-1 ring-border"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {POS_LABEL[p.position]} · {team?.name}{p.club ? ` · ${p.club}` : ""}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            <Button
              onClick={() => draft && save.mutate(draft)}
              disabled={!draft || draft === pick?.player_id || save.isPending}
              className="mt-3 w-full sm:w-auto"
            >
              {pick ? "Modifier mon choix" : "Enregistrer"}
            </Button>
          </div>
        )}

        {topScorer && pick && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div className="text-sm">
              <div className="font-semibold">
                Bonus final : +{pick.player_id === topScorer.id ? 10 : 0} pts
              </div>
              <div className="text-xs text-muted-foreground">
                Soulier d'Or : {topScorer.name} ({teamById.get(topScorer.team_id)?.name})
              </div>
            </div>
          </div>
        )}

        {liveRanking.length > 0 && (
          <div className="mt-4 rounded-md border bg-card/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Goal className="h-3.5 w-3.5 text-emerald-500" /> Classement des buteurs en direct
            </div>
            <ul className="space-y-1">
              {liveRanking.map((p, i) => {
                const team = teamById.get(p.team_id);
                const isPicked = pick?.player_id === p.id;
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                      isPicked ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" : ""
                    }`}
                  >
                    <span className="w-5 text-right font-mono text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    {team && (
                      <img
                        src={`https://flagcdn.com/w20/${team.code}.png`}
                        alt=""
                        className="h-4 w-6 rounded-sm object-cover ring-1 ring-border"
                      />
                    )}
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {p.goals}
                    </span>
                    {p.assists > 0 && (
                      <span className="text-xs text-muted-foreground">+{p.assists} PD</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Mis à jour automatiquement chaque jour pendant le tournoi.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
