function MatchCard({ match, prediction, canPredict }: { match: Match; prediction?: Prediction; canPredict: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [scoreA, setScoreA] = useState<string>(prediction ? String(prediction.score_a) : "");
  const [scoreB, setScoreB] = useState<string>(prediction ? String(prediction.score_b) : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.rpc('get_match_stats', { match_id_param: match.id });
      if (data && data.length > 0) setStats(data[0]);
    };
    fetchStats();
  }, [match.id]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("predictions")
      .upsert({ user_id: user.id, match_id: match.id, score_a: Number(scoreA), score_b: Number(scoreB) }, { onConflict: "user_id,match_id" });
    setBusy(false);
    if (!error) {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["predictions"] });
    }
  }

  const locked = isLocked(match.kickoff_at);

  return (
    <Card className="p-4 border shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold">{match.team_a?.name || "..."} vs {match.team_b?.name || "..."}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
         <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center text-white bg-black" />
         <span className="text-white">-</span>
         <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={locked || busy} className="w-12 p-2 border rounded text-center text-white bg-black" />
         <Button onClick={save} disabled={locked || busy}>OK</Button>
      </div>

      {/* Affichage simple des chiffres en BLANC */}
      {stats && stats.total_votes > 0 && (
        <div className="mt-4 text-center">
          <p className="text-white text-sm font-bold">
            {stats.total_votes} pronostics enregistrés
          </p>
        </div>
      )}
    </Card>
  );
}