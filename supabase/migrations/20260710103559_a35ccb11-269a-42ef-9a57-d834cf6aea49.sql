DROP TRIGGER IF EXISTS trg_matches_after_result ON public.matches;
CREATE TRIGGER trg_matches_after_result
AFTER UPDATE OF score_a, score_b, score_a_et, score_b_et, score_a_pen, score_b_pen, finished
ON public.matches
FOR EACH ROW
WHEN (
  OLD.score_a IS DISTINCT FROM NEW.score_a OR
  OLD.score_b IS DISTINCT FROM NEW.score_b OR
  OLD.score_a_et IS DISTINCT FROM NEW.score_a_et OR
  OLD.score_b_et IS DISTINCT FROM NEW.score_b_et OR
  OLD.score_a_pen IS DISTINCT FROM NEW.score_a_pen OR
  OLD.score_b_pen IS DISTINCT FROM NEW.score_b_pen OR
  OLD.finished IS DISTINCT FROM NEW.finished
)
EXECUTE FUNCTION public.matches_after_result();

DROP TRIGGER IF EXISTS trg_predictions_guard_server_fields ON public.predictions;
CREATE TRIGGER trg_predictions_guard_server_fields
BEFORE INSERT OR UPDATE ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.predictions_guard_server_fields();

DROP TRIGGER IF EXISTS trg_check_prediction_lock ON public.predictions;
CREATE TRIGGER trg_check_prediction_lock
BEFORE INSERT OR UPDATE ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.check_prediction_lock();