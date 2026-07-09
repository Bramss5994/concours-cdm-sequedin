CREATE OR REPLACE FUNCTION public.check_winner_prediction_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  revote_deadline timestamptz := '2026-07-09 18:00:00+00'; -- 20h Paris
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Choix initial : verrouillé (plus de modification possible)
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Le choix initial du vainqueur est fermé.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.initial_team_id IS DISTINCT FROM OLD.initial_team_id THEN
    RAISE EXCEPTION 'Le choix initial du vainqueur est fermé.';
  END IF;

  -- Re-vote (final_team_id) : ouvert jusqu'au 9 juillet 2026 20h Paris
  IF TG_OP = 'UPDATE' AND NEW.final_team_id IS DISTINCT FROM OLD.final_team_id THEN
    IF now() >= revote_deadline THEN
      RAISE EXCEPTION 'Le re-vote est fermé (clôture le 9 juillet 2026 à 20h).';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;