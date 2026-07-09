
-- Allow users without an initial pick to cast a final (revote) vote
ALTER TABLE public.winner_predictions ALTER COLUMN initial_team_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.check_winner_prediction_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  revote_deadline timestamptz := '2026-07-09 18:00:00+00';
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Initial pick is closed: prevent creating a new initial vote
    IF NEW.initial_team_id IS NOT NULL THEN
      RAISE EXCEPTION 'Le choix initial du vainqueur est fermé.';
    END IF;
    -- Allow inserting a final (revote) pick during the revote window
    IF NEW.final_team_id IS NULL THEN
      RAISE EXCEPTION 'Choix final requis.';
    END IF;
    IF now() >= revote_deadline THEN
      RAISE EXCEPTION 'Le re-vote est fermé (clôture le 9 juillet 2026 à 20h).';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.initial_team_id IS DISTINCT FROM OLD.initial_team_id THEN
    RAISE EXCEPTION 'Le choix initial du vainqueur est fermé.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.final_team_id IS DISTINCT FROM OLD.final_team_id THEN
    IF now() >= revote_deadline THEN
      RAISE EXCEPTION 'Le re-vote est fermé (clôture le 9 juillet 2026 à 20h).';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Update bonus logic to award +5 when a user with no initial pick correctly picks champion in revote
CREATE OR REPLACE FUNCTION public.get_winner_bonuses()
 RETURNS TABLE(user_id uuid, bonus integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHEN wp.initial_team_id IS NULL
        THEN CASE WHEN wp.final_team_id = champion THEN 5 ELSE 0 END
      WHEN groups_done AND wp.initial_team_id NOT IN (SELECT tid FROM ko_teams)
        THEN CASE WHEN wp.final_team_id = champion THEN 5 ELSE 0 END
      WHEN wp.final_team_id = wp.initial_team_id AND wp.initial_team_id = champion THEN 15
      WHEN wp.final_team_id IS NULL AND wp.initial_team_id = champion THEN 10
      WHEN wp.final_team_id IS NOT NULL
        AND wp.final_team_id <> wp.initial_team_id
        AND wp.final_team_id = champion THEN 5
      ELSE 0
    END AS bonus
  FROM public.winner_predictions wp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_winner_board()
 RETURNS TABLE(user_id uuid, prenom text, num_paie text, depot depot, initial_team_id uuid, initial_team_name text, initial_team_code text, final_team_id uuid, final_team_name text, final_team_code text, bonus integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  champion uuid;
  groups_done boolean;
BEGIN
  SELECT winner_team_id INTO champion
  FROM public.matches
  WHERE stage = 'final' AND finished = true
  ORDER BY kickoff_at DESC
  LIMIT 1;

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
    p.prenom,
    p.num_paie,
    p.depot,
    wp.initial_team_id,
    ti.name AS initial_team_name,
    ti.code AS initial_team_code,
    wp.final_team_id,
    tf.name AS final_team_name,
    tf.code AS final_team_code,
    CASE
      WHEN champion IS NULL THEN 0
      WHEN wp.initial_team_id IS NULL
        THEN CASE WHEN wp.final_team_id = champion THEN 5 ELSE 0 END
      WHEN groups_done AND wp.initial_team_id NOT IN (SELECT tid FROM ko_teams)
        THEN CASE WHEN wp.final_team_id = champion THEN 5 ELSE 0 END
      WHEN wp.final_team_id = wp.initial_team_id AND wp.initial_team_id = champion THEN 15
      WHEN wp.final_team_id IS NULL AND wp.initial_team_id = champion THEN 10
      WHEN wp.final_team_id IS NOT NULL
        AND wp.final_team_id <> wp.initial_team_id
        AND wp.final_team_id = champion THEN 5
      ELSE 0
    END AS bonus
  FROM public.winner_predictions wp
  JOIN public.profiles p ON p.id = wp.user_id AND p.active = true
  LEFT JOIN public.teams ti ON ti.id = wp.initial_team_id
  LEFT JOIN public.teams tf ON tf.id = wp.final_team_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin'
  );
END;
$function$;
