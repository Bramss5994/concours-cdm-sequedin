
CREATE OR REPLACE FUNCTION public.check_top_scorer_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE first_kick timestamptz;
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  SELECT min(kickoff_at) INTO first_kick FROM public.matches;
  IF first_kick IS NOT NULL AND now() >= first_kick THEN
    RAISE EXCEPTION 'Le pronostic meilleur buteur est verrouillé (le tournoi a commencé).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_winner_prediction_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  first_kick timestamptz;
  groups_done boolean;
  first_ko timestamptz;
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT min(kickoff_at) INTO first_kick FROM public.matches;
  SELECT NOT EXISTS (SELECT 1 FROM public.matches WHERE stage = 'group' AND finished = false) INTO groups_done;
  SELECT min(kickoff_at) INTO first_ko FROM public.matches WHERE stage <> 'group';

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.initial_team_id IS DISTINCT FROM OLD.initial_team_id) THEN
    IF first_kick IS NOT NULL AND now() >= first_kick THEN
      RAISE EXCEPTION 'Le choix initial est verrouillé (la Coupe du Monde a déjà commencé).';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.final_team_id IS DISTINCT FROM OLD.final_team_id THEN
    IF NOT COALESCE(groups_done, false) THEN
      RAISE EXCEPTION 'Le re-vote n''est pas encore ouvert (phases de groupes en cours).';
    END IF;
    IF first_ko IS NOT NULL AND now() >= first_ko THEN
      RAISE EXCEPTION 'Le re-vote est fermé (les phases finales ont commencé).';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
