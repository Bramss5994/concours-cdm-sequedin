import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Vote, Trophy, Goal } from "lucide-react";
import { WinnerTeamPicker } from "@/components/WinnerTeamPicker";
import { TopScorerPicker } from "@/components/TopScorerPicker";

export function QuickVoteFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"winner" | "scorer">("winner");
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: winnerPick } = useQuery({
    queryKey: ["winner-prediction", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("winner_predictions")
        .select("initial_team_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: scorerPick } = useQuery({
    queryKey: ["top-scorer-prediction", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("top_scorer_predictions")
        .select("player_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!user) return null;
  if (path.startsWith("/auth") || path.startsWith("/reset-password") || path.startsWith("/unite")) return null;

  const missingWinner = !winnerPick?.initial_team_id;
  const missingScorer = !scorerPick?.player_id;
  const missingCount = (missingWinner ? 1 : 0) + (missingScorer ? 1 : 0);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setTab(missingWinner ? "winner" : missingScorer ? "scorer" : "winner");
      }}
    >
      <SheetTrigger asChild>
        <Button
          size="lg"
          aria-label="Mes votes spéciaux"
          className="fixed bottom-5 right-5 z-40 h-14 rounded-full px-5 shadow-xl shadow-primary/30 sm:bottom-6 sm:right-6"
        >
          <Vote className="mr-2 h-5 w-5" />
          <span className="font-semibold">Mes votes</span>
          {missingCount > 0 && (
            <span className="ml-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground ring-2 ring-background">
              {missingCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-2xl p-0 sm:max-w-2xl sm:mx-auto"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" /> Mes votes spéciaux
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Modifiables à tout moment — pensez à enregistrer vos choix !
          </p>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "winner" | "scorer")} className="px-3 py-3 sm:px-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="winner" className="gap-1.5">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Équipe gagnante</span>
              <span className="sm:hidden">Équipe</span>
              {missingWinner && <span className="ml-1 h-2 w-2 rounded-full bg-destructive" />}
            </TabsTrigger>
            <TabsTrigger value="scorer" className="gap-1.5">
              <Goal className="h-4 w-4" />
              <span className="hidden sm:inline">Soulier d'Or</span>
              <span className="sm:hidden">Buteur</span>
              {missingScorer && <span className="ml-1 h-2 w-2 rounded-full bg-destructive" />}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="winner" className="mt-3">
            <WinnerTeamPicker />
          </TabsContent>
          <TabsContent value="scorer" className="mt-3">
            <TopScorerPicker />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
