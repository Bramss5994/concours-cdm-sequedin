import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { DEPOTS as DEPOT_LIST, DEPOT_LABEL, DEPOT_LOGO } from "@/lib/depots";
import goldenBoot from "@/assets/golden-boot.png.asset.json";

export const Route = createFileRoute("/top-scorer")({ component: TopScorerBoard });

const DEPOTS = [
  { value: "all", label: "Tous les dépôts" },
  ...DEPOT_LIST.map((d) => ({ value: d.value, label: d.label })),
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

type Row = {
  user_id: string; prenom: string; num_paie: string; depot: string;
  player_id: string; player_name: string; player_club: string | null;
  team_name: string | null; bonus: number;
};

function GoldenBoot({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <motion.img
      src={goldenBoot.url}
      alt="Soulier d'or"
      className={`${className} object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.4)]`}
      initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 14 }}
    />
  );
}

function TopScorerBoard() {
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
    queryKey: ["top-scorer-board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_scorer_board");
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
          <GoldenBoot className="mx-auto h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Classement Soulier d'Or réservé aux participants</h1>
          <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour consulter le classement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Gold-tinted WC background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7B2CBF] via-[#E4002B] to-[#FFB100] opacity-90" />
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#FFD100] opacity-50 blur-3xl" />
        <div className="absolute -right-10 top-20 h-80 w-80 rounded-full bg-[#FF8A00] opacity-40 blur-3xl" />
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
            <Trophy className="h-3.5 w-3.5 text-[#FFD100]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">FIFA World Cup 26</span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <GoldenBoot className="h-20 w-20 sm:h-24 sm:w-24" />
            <div>
              <h1 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">
                SOULIER D'OR
              </h1>
              <p className="mt-2 text-sm text-white/85">
                +10 pts si votre pronostic du meilleur buteur est correct.
              </p>
            </div>
          </div>
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
          <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Aucun pronostic Soulier d'Or pour le moment.</CardContent></Card>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {board.map((r, i) => {
              const isMe = user.id === r.user_id;
              return (
                <motion.div
                  key={r.user_id}
                  variants={fadeUp}
                  custom={Math.min(i, 12)}
                  whileHover={{ y: -3 }}
                  className={`relative overflow-hidden rounded-2xl shadow-xl ${isMe ? "ring-2 ring-[#FFD100]" : ""}`}
                  style={{
                    background:
                      "linear-gradient(135deg, #1a0b2e 0%, #3b1f5e 45%, #7B2CBF 100%)",
                  }}
                >
                  {/* Decorative golden boot watermark */}
                  <img
                    src={goldenBoot.url}
                    alt=""
                    className="pointer-events-none absolute -bottom-6 -right-6 h-44 w-44 rotate-12 object-contain opacity-20"
                  />

                  {/* Position badge */}
                  <div className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-[#FFD100] text-base font-black text-black shadow-lg ring-1 ring-white/40">
                    {i === 0 ? <Trophy className="h-5 w-5" /> : `#${i + 1}`}
                  </div>

                  <div className="relative p-4 text-white">
                    <div className="pr-12">
                      <div className="text-base font-black leading-tight drop-shadow">{r.name}</div>
                      {isMe && (
                        <Badge className="mt-1 h-4 bg-[#FFD100] px-1.5 text-[9px] font-bold text-black">Moi</Badge>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur-md">
                        <img src={DEPOT_LOGO[r.depot]} alt="" className="h-4 w-4 rounded-full object-cover" />
                        <span className="text-[10px] font-semibold">{DEPOT_LABEL[r.depot] || r.depot}</span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/30 p-2.5 backdrop-blur-md ring-1 ring-[#FFD100]/30">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#FFD100] to-[#B45309] shadow-inner">
                        <img src={goldenBoot.url} alt="" className="h-10 w-10 object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[#FFD100]/90">
                          Buteur choisi
                        </div>
                        <div className="truncate text-sm font-bold">{r.player_name}</div>
                        {(r.team_name || r.player_club) && (
                          <div className="truncate text-[11px] text-white/70">
                            {[r.team_name, r.player_club].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[#FFD100]/90">Bonus</div>
                        <div className="text-2xl font-black tabular-nums text-[#FFD100]">{r.bonus}</div>
                      </div>
                    </div>
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
  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-xl ${highlight ? "ring-2 ring-[#FFD100]" : ""}`}
      style={{
        background: "linear-gradient(135deg, #1a0b2e 0%, #3b1f5e 45%, #7B2CBF 100%)",
      }}
    >
      <img
        src={goldenBoot.url}
        alt=""
        className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 rotate-12 object-contain opacity-20"
      />
      <div className="relative p-4 text-white">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFD100]/90">{name}</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFD100] to-[#B45309] shadow-inner">
            <img src={goldenBoot.url} alt="" className="h-12 w-12 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-black drop-shadow">{r.player_name}</div>
            {(r.team_name || r.player_club) && (
              <div className="truncate text-xs text-white/75">
                {[r.team_name, r.player_club].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#FFD100]/90">Bonus</div>
            <div className="text-3xl font-black tabular-nums text-[#FFD100]">{r.bonus}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
