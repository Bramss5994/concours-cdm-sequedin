CREATE OR REPLACE FUNCTION public.get_winner_bonuses()
RETURNS TABLE(user_id uuid, bonus integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  champion uuid;
  groups_done boolean;
BEGIN
  SELECT winner_team_id INTO champion
  FROM public.matches
  WHERE stage = 'final' AND finished = true
  ORDER BY kickoff_at DESC
  LIMIT 1;

  IF champion IS NULL THEN
    RETURN;
  END IF;

  SELECT NOT EXISTS (SELECT 1 FROM public.matches WHERE stage = 'group' AND finished = false)
    INTO groups_done;

  RETURN QUERY
  WITH ko_teams AS (
    SELECT team_a_id AS tid FROM public.matches WHERE stage <> 'group' AND team_a_id IS NOT NULL
    UNION
    SELECT team_b_id FROM public.matches WHERE stage <> 'group' AND team_b_id IS NOT NULL
  )
  SELECT
    wp.user_id,
    CASE
      -- initial team eliminated in groups
      WHEN groups_done AND wp.initial_team_id NOT IN (SELECT tid FROM ko_teams)
        THEN CASE WHEN wp.final_team_id = champion THEN 5 ELSE 0 END
      -- kept the same pick and they win
      WHEN wp.final_team_id = wp.initial_team_id AND wp.initial_team_id = champion THEN 15
      -- no re-vote, initial wins
      WHEN wp.final_team_id IS NULL AND wp.initial_team_id = champion THEN 10
      -- changed pick, new pick wins
      WHEN wp.final_team_id IS NOT NULL
        AND wp.final_team_id <> wp.initial_team_id
        AND wp.final_team_id = champion THEN 5
      ELSE 0
    END AS bonus
  FROM public.winner_predictions wp;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_winner_bonuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_winner_bonuses() TO authenticated;