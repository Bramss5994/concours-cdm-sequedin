DROP TRIGGER IF EXISTS matches_after_result_trg ON public.matches;
CREATE TRIGGER matches_after_result_trg
AFTER UPDATE OF score_a, score_b, finished ON public.matches
FOR EACH ROW
WHEN (NEW.finished = true AND NEW.score_a IS NOT NULL AND NEW.score_b IS NOT NULL)
EXECUTE FUNCTION public.matches_after_result();