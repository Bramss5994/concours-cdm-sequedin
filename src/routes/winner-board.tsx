import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";
import { DEPOTS as DEPOT_LIST, DEPOT_LABEL, DEPOT_LOGO } from "@/lib/depots";
import { teamPalette, teamGradient } from "@/lib/team-colors";

export const Route = createFileRoute("/winner-board")({ component: WinnerBoard });

const DEPOTS = [
  { value: "all", label: "Tous les dépôts" },
  ...DEPOT_LIST.map((d) => ({ value: d.value, label: d.label })),
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

function flagUrl(code: string | null | undefined) {
  if (!code) return null;
  return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
}

type Row = {
  user_id: string; prenom: string; num_paie: string; depot: string;
  initial_team_id: string | null; initial_team_name: string | null; initial_team_code: string | null;
  final_team_id: string | null; final_team_name: string | null; final_team_code: string | null;
  bonus: number;
};

function WinnerBoard() {
  const { user, isAdmin } = useAuth();
  const [depotFilter, setDepotFilter] = useState<string>("all");

  const { data: myDepot } = useQuery({
    queryKey: ["my-depot", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("depot").eq("id", user!.id).maybeSingle();
      return (data?.depot as string | undefined) ?? null;
    },
  });

  useEffect(() => {
    if (!isAdmin && myDepot) setDepotFilter(myDepot);
  }, [isAdmin, myDepot]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["winner-board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_winner_board");
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const board = useMemo(() => {
    return rows
      .filter((r) => depotFilter === "all" || r.depot === depotFilter)
      .map((r) => ({ ...r, name: `${r.prenom} ${r.num_paie}`.trim() || "Anonyme" }))
      .sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name));
  }, [rows, depotFilter]);

  const myPick = user ? board.find((r) => r.user_id === user.id) : null;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl text-center">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Classement Équipe gagnante réservé aux participants</h1>
          <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour consulter le classement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* WC 2026 gradient background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E4002B] via-[#7B2CBF] to-[#00A3E0] opacity-90" />
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#FFD100] opacity-40 blur-3xl" />
        <div className="absolute -right-20 top-32 h-72 w-72 rounded-full bg-[#00C389] opacity-40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(255,255,255,0)_0%,_hsl(var(--background))_70%)]" />
      </div>

      <div className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-white"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md ring-1 ring-white/30">
            <Crown className="h-3.5 w-3.5 text-[#FFD100]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">FIFA World Cup 26</span>
          </div>
          <h1 className="mt-3 text-3xl font-black leading-none tracking-tight sm:text-5xl">
            ÉQUIPE GAGNANTE
          </h1>
          <p className="mt-2 text-sm text-white/85">
            +15 pts (choix initial conservé), +10 pts (choix initial sans re-vote), +5 pts (re-vote gagnant).
          </p>
        </motion.div>

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Dépôt</span>
            <Select value={depotFilter} onValueChange={setDepotFilter}>
              <SelectTrigger className="w-[200px] border-white/30 bg-white/15 text-white backdrop-blur-md hover:bg-white/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPOTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="mt-4">
            <Badge className="border-white/30 bg-white/15 text-white backdrop-blur-md">
              {DEPOT_LABEL[depotFilter] || depotFilter}
            </Badge>
          </div>
        )}

        {myPick && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-5"
          >
            <PickCard r={myPick} name="Mon pronostic" highlight />
          </motion.div>
        )}

        {isLoading ? (
          <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Chargement…</CardContent></Card>
        ) : board.length === 0 ? (
          <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Aucun pronostic « équipe gagnante » pour le moment.</CardContent></Card>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {board.map((r, i) => {
              const isMe = user.id === r.user_id;
              const code = r.final_team_code || r.initial_team_code;
              const palette = teamPalette(code);
              return (
                <motion.div
                  key={r.user_id}
                  variants={fadeUp}
                  custom={Math.min(i, 12)}
                  whileHover={{ y: -3 }}
                  className={`relative overflow-hidden rounded-2xl shadow-xl ${isMe ? "ring-2 ring-[#FFD100]" : ""}`}
                  style={{ background: teamGradient(code) }}
                >
                  {/* Position badge */}
                  <div className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-base font-black text-white backdrop-blur-md ring-1 ring-white/40">
                    {i === 0 ? <Trophy className="h-5 w-5 text-[#FFD100]" /> : `#${i + 1}`}
                  </div>

                  {/* Flag watermark */}
                  {flagUrl(code) && (
                    <img
                      src={flagUrl(code)!}
                      alt=""
                      className="pointer-events-none absolute -bottom-6 -right-6 h-48 w-48 rounded-full object-cover opacity-15"
                    />
                  )}

                  <div
                    className="relative p-4"
                    style={{
                      color: palette.primary === "#FFFFFF" ? "#0b0b14" : "#FFFFFF",
                      textShadow: palette.primary === "#FFFFFF" ? "none" : "0 1px 2px rgba(0,0,0,.4)",
                    }}
                  >
                    <div className="pr-12">
                      <div className="text-base font-black leading-tight">{r.name}</div>
                      {isMe && (
                        <Badge className="mt-1 h-4 bg-[#FFD100] px-1.5 text-[9px] font-bold text-black">Moi</Badge>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5 backdrop-blur-md">
                        <img src={DEPOT_LOGO[r.depot]} alt="" className="h-4 w-4 rounded-full object-cover" />
                        <span className="text-[10px] font-semibold">{DEPOT_LABEL[r.depot] || r.depot}</span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/25 p-2.5 backdrop-blur-md">
                      {flagUrl(r.initial_team_code) ? (
                        <img src={flagUrl(r.initial_team_code)!} alt="" className="h-8 w-12 rounded-sm object-cover ring-1 ring-white/40" />
                      ) : (
                        <div className="h-8 w-12 rounded-sm bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Choix initial</div>
                        <div className="truncate text-sm font-bold">{r.initial_team_name || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Bonus</div>
                        <div className="text-2xl font-black tabular-nums">{r.bonus}</div>
                      </div>
                    </div>

                    {r.final_team_id && r.final_team_id !== r.initial_team_id && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs backdrop-blur-md">
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Re-vote</span>
                        {flagUrl(r.final_team_code) && (
                          <img src={flagUrl(r.final_team_code)!} alt="" className="h-4 w-6 rounded-sm object-cover" />
                        )}
                        <span className="truncate font-semibold">{r.final_team_name}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function PickCard({ r, name, highlight }: { r: Row & { name: string }; name: string; highlight?: boolean }) {
  const code = r.final_team_code || r.initial_team_code;
  const palette = teamPalette(code);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-xl ${highlight ? "ring-2 ring-[#FFD100]" : ""}`}
      style={{ background: teamGradient(code) }}
    >
      {flagUrl(code) && (
        <img src={flagUrl(code)!} alt="" className="pointer-events-none absolute -bottom-8 -right-8 h-56 w-56 rounded-full object-cover opacity-15" />
      )}
      <div
        className="relative p-4"
        style={{
          color: palette.primary === "#FFFFFF" ? "#0b0b14" : "#FFFFFF",
          textShadow: palette.primary === "#FFFFFF" ? "none" : "0 1px 2px rgba(0,0,0,.4)",
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-90">{name}</div>
        <div className="mt-2 flex items-center gap-3">
          {flagUrl(r.initial_team_code) && (
            <img src={flagUrl(r.initial_team_code)!} alt="" className="h-10 w-14 rounded-sm object-cover ring-1 ring-white/40" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-black">{r.initial_team_name || "—"}</div>
            {r.final_team_id && r.final_team_id !== r.initial_team_id && (
              <div className="mt-0.5 text-xs opacity-90">Re-vote : {r.final_team_name}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-90">Bonus</div>
            <div className="text-3xl font-black tabular-nums">{r.bonus}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
