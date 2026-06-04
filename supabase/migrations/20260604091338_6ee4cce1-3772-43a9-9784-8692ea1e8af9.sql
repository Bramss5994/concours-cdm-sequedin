
CREATE OR REPLACE FUNCTION public.get_top_scorer_board()
RETURNS TABLE(
  user_id uuid,
  prenom text,
  num_paie text,
  depot public.depot,
  player_id uuid,
  player_name text,
  player_club text,
  team_name text,
  bonus integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH top AS (
    SELECT id FROM public.players WHERE is_top_scorer = true LIMIT 1
  )
  SELECT
    tsp.user_id,
    p.prenom,
    p.num_paie,
    p.depot,
    pl.id AS player_id,
    pl.name AS player_name,
    pl.club AS player_club,
    t.name AS team_name,
    CASE WHEN (SELECT id FROM top) IS NOT NULL AND pl.id = (SELECT id FROM top) THEN 10 ELSE 0 END AS bonus
  FROM public.top_scorer_predictions tsp
  JOIN public.profiles p ON p.id = tsp.user_id AND p.active = true
  JOIN public.players pl ON pl.id = tsp.player_id
  LEFT JOIN public.teams t ON t.id = pl.team_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_top_scorer_board() TO authenticated;
