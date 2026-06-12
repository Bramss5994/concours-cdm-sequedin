import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Team = { id: string; code: string; name: string; group_letter: string | null };
type Match = {
  id: string;
  stage: string;
  kickoff_at: string;
  finished: boolean;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
};

export function WinnerTeamPicker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draftInitial, setDraftInitial] = useState<string | undefined>();
  const [draftFinal, setDraftFinal] = useState<string | undefined>();

  const { data: teams = [] } = useQuery({
    queryKey: ["wp-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, code, name, group_letter")
        .order("name");
      return (data || []) as Team[];
    },
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["wp-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, stage, kickoff_at, finished, team_a_id, team_b_id, winner_team_id");
      return (data || []) as Match[];
    },
  });

  const { data: pick } = useQuery({
    queryKey: ["winner-prediction", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("winner_predictions")
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

  // Choix initial toujours ouvert pour tous les inscrits.


  const state = useMemo(() => {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const firstKick = matches.reduce<string | null>(
      (acc, m) => (acc === null || m.kickoff_at < acc ? m.kickoff_at : acc),
      null,
    );
    const koMatches = matches.filter((m) => m.stage !== "group");
    const firstKo = koMatches.reduce<string | null>(
      (acc, m) => (acc === null || m.kickoff_at < acc ? m.kickoff_at : acc),
      null,
    );
    const groupsAllFinished =
      matches.some((m) => m.stage === "group") &&
      matches.filter((m) => m.stage === "group").every((m) => m.finished);
    const now = Date.now();
    const initialOpen = true;
    const revoteOpen =
      groupsAllFinished && (!firstKo || now < new Date(firstKo).getTime());

    const finalMatch = matches.find((m) => m.stage === "final" && m.finished);
    const champion = finalMatch?.winner_team_id ?? null;

    const koTeamIds = new Set<string>();
    for (const m of koMatches) {
      if (m.team_a_id) koTeamIds.add(m.team_a_id);
      if (m.team_b_id) koTeamIds.add(m.team_b_id);
    }
    const isEliminatedInGroups = (teamId: string | null | undefined) => {
      if (!teamId) return false;
      if (!groupsAllFinished) return false;
      return !koTeamIds.has(teamId);
    };

    return {
      teamById,
      initialOpen,
      revoteOpen,
      groupsAllFinished,
      champion,
      isEliminatedInGroups,
      firstKick,
      firstKo,
    };
  }, [teams, matches]);

  const saveInitial = useMutation({
    mutationFn: async (teamId: string) => {
      const payload = { user_id: user!.id, initial_team_id: teamId };
      const { error } = await supabase
        .from("winner_predictions")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winner-prediction"] });
      toast.success("Choix initial enregistré !");
      setDraftInitial(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveFinal = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("winner_predictions")
        .update({ final_team_id: teamId })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winner-prediction"] });
      toast.success("Choix après phase de groupes enregistré !");
      setDraftFinal(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) return null;

  const initialTeam = pick?.initial_team_id ? state.teamById.get(pick.initial_team_id) : null;
  const finalTeam = pick?.final_team_id ? state.teamById.get(pick.final_team_id) : null;
  const initialEliminated = state.isEliminatedInGroups(pick?.initial_team_id);

  // Bonus estimation
  let bonus = 0;
  let bonusDetail = "";
  if (state.champion && pick) {
    const championWonByInitial = pick.initial_team_id === state.champion;
    const championWonByFinal = pick.final_team_id === state.champion;
    const kept = pick.final_team_id && pick.final_team_id === pick.initial_team_id;
    if (initialEliminated) {
      bonus = championWonByFinal ? 5 : 0;
      bonusDetail = championWonByFinal
        ? "Équipe initiale éliminée mais re-vote gagnant : +5"
        : "Équipe initiale éliminée en phase de groupes : 0";
    } else if (kept && championWonByInitial) {
      bonus = 15;
      bonusDetail = "Choix initial conservé et champion : +10 +5";
    } else if (!pick.final_team_id && championWonByInitial) {
      bonus = 10;
      bonusDetail = "Choix initial champion : +10";
    } else if (pick.final_team_id && pick.final_team_id !== pick.initial_team_id) {
      bonus = championWonByFinal ? 5 : 0;
      bonusDetail = championWonByFinal
        ? "Re-vote gagnant : +5 (initial perdu)"
        : "Re-vote perdant : 0";
    } else {
      bonus = 0;
    }
  }

  return (
    <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-background">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">Mon pronostic vainqueur de la Coupe du Monde</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          +10 pts si votre équipe initiale gagne. Après les phases de groupes vous pourrez
          confirmer (+5 bonus) ou changer (vous perdez les 10, mais gagnez +5 si la nouvelle équipe est championne).
        </p>
        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Choix initial modifiable à tout moment pour tous les inscrits.
        </p>


        {/* INITIAL PICK */}
        <div className="mt-4 rounded-md border bg-card/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Choix initial
            </div>
            {state.initialOpen ? (
              <Badge variant="secondary" className="text-xs">Modifiable</Badge>
            ) : (
              <Badge variant="outline" className="text-xs"><Lock className="mr-1 h-3 w-3" />Verrouillé</Badge>
            )}
          </div>

          {initialTeam && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={`https://flagcdn.com/w40/${initialTeam.code}.png`}
                alt=""
                className="h-5 w-7 rounded-sm object-cover ring-1 ring-border"
              />
              <span className="font-medium">{initialTeam.name}</span>
              {initialEliminated && (
                <Badge variant="destructive" className="ml-1 text-[10px]">
                  <AlertTriangle className="mr-1 h-3 w-3" />Éliminée
                </Badge>
              )}
            </div>
          )}

          {state.initialOpen && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Select
                value={draftInitial ?? pick?.initial_team_id ?? undefined}
                onValueChange={setDraftInitial}
              >
                <SelectTrigger className="sm:flex-1">
                  <SelectValue placeholder="Choisir une équipe" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.group_letter ? `· Groupe ${t.group_letter}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => draftInitial && saveInitial.mutate(draftInitial)}
                disabled={!draftInitial || draftInitial === pick?.initial_team_id || saveInitial.isPending}
              >
                {pick ? "Modifier" : "Enregistrer"}
              </Button>
            </div>
          )}
        </div>

        {/* FINAL PICK (re-vote) */}
        {pick && (
          <div className="mt-3 rounded-md border bg-card/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Choix après phases de groupes
              </div>
              {state.revoteOpen ? (
                <Badge variant="secondary" className="text-xs">Ouvert</Badge>
              ) : state.groupsAllFinished ? (
                <Badge variant="outline" className="text-xs"><Lock className="mr-1 h-3 w-3" />Fermé</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Disponible après les groupes</Badge>
              )}
            </div>

            {finalTeam && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={`https://flagcdn.com/w40/${finalTeam.code}.png`}
                  alt=""
                  className="h-5 w-7 rounded-sm object-cover ring-1 ring-border"
                />
                <span className="font-medium">{finalTeam.name}</span>
                {pick.final_team_id === pick.initial_team_id ? (
                  <Badge variant="secondary" className="text-[10px]">Confirmée (+5 si championne)</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Changée (10 perdus, +5 si championne)</Badge>
                )}
              </div>
            )}

            {state.revoteOpen && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select
                  value={draftFinal ?? pick.final_team_id ?? pick.initial_team_id ?? undefined}
                  onValueChange={setDraftFinal}
                >
                  <SelectTrigger className="sm:flex-1">
                    <SelectValue placeholder="Confirmer ou changer" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.id === pick.initial_team_id ? "· (mon choix initial)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => draftFinal && saveFinal.mutate(draftFinal)}
                  disabled={!draftFinal || draftFinal === pick.final_team_id || saveFinal.isPending}
                >
                  Enregistrer
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Bonus result once tournament is over */}
        {state.champion && pick && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">Bonus final : +{bonus} pts</div>
              <div className="text-xs text-muted-foreground">{bonusDetail}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
