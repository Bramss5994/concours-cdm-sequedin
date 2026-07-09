CREATE OR REPLACE FUNCTION public.check_top_scorer_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Les pronostics Soulier d''Or sont fermés.';
END;
$function$;