import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export function FavoriteTeamPicker() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, code, name, group_letter").order("name");
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-favorite", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("favorite_team_id").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ favorite_team_id: teamId })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-favorite"] });
      toast.success("Équipe favorite enregistrée !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" fill="currentColor" />
          <h3 className="font-semibold">Mon équipe favorite</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez l'équipe que vous supportez pour la Coupe du Monde 2026.
        </p>
        <div className="mt-4">
          <Select
            value={profile?.favorite_team_id ?? undefined}
            onValueChange={(v) => mutation.mutate(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionne une équipe" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} {t.group_letter ? `· Groupe ${t.group_letter}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
