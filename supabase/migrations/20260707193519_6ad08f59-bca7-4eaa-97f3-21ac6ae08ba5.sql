
CREATE OR REPLACE FUNCTION public.check_prediction_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE k TIMESTAMPTZ;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF auth.role() = 'service_role' THEN
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
