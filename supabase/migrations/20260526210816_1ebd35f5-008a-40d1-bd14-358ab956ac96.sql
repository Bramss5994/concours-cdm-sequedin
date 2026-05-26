
-- Enable realtime
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.predictions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;

-- Trigger: recompute points whenever a match score is updated
DROP TRIGGER IF EXISTS trg_matches_after_result ON public.matches;
CREATE TRIGGER trg_matches_after_result
AFTER UPDATE OF score_a, score_b, finished ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.matches_after_result();

-- Recompute points for all already-finished matches
DO $$
DECLARE m RECORD;
BEGIN
  FOR m IN SELECT id FROM public.matches WHERE finished = true LOOP
    PERFORM public.recompute_match_points(m.id);
  END LOOP;
END $$;
