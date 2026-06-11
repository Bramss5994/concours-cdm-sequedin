
CREATE OR REPLACE FUNCTION public.check_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE k TIMESTAMPTZ;
BEGIN
  -- Si l'update vient d'un autre trigger (ex: recompute_match_points), on laisse passer
  IF pg_trigger_depth() > 1 THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF now() >= (k - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Pronostics fermés pour ce match (clôture 1h avant le coup d''envoi).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.predictions_guard_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Si l'update vient d'un autre trigger (ex: recompute_match_points), on laisse passer
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.points := 0;
    NEW.exact_score := false;
    NEW.good_winner := false;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.points := OLD.points;
    NEW.exact_score := OLD.exact_score;
    NEW.good_winner := OLD.good_winner;
  END IF;

  RETURN NEW;
END;
$function$;
