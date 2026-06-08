
CREATE OR REPLACE FUNCTION public.predictions_guard_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

REVOKE EXECUTE ON FUNCTION public.predictions_guard_server_fields() FROM anon, public;

DROP TRIGGER IF EXISTS predictions_guard_server_fields_ins ON public.predictions;
CREATE TRIGGER predictions_guard_server_fields_ins
  BEFORE INSERT ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.predictions_guard_server_fields();

DROP TRIGGER IF EXISTS predictions_guard_server_fields_upd ON public.predictions;
CREATE TRIGGER predictions_guard_server_fields_upd
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.predictions_guard_server_fields();
