CREATE OR REPLACE FUNCTION public.recompute_match_points(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m RECORD;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.score_a IS NULL OR m.score_b IS NULL OR NOT m.finished THEN
    UPDATE public.predictions SET points = 0, exact_score = false, good_winner = false
      WHERE match_id = _match_id;
    RETURN;
  END IF;

  UPDATE public.predictions p SET
    exact_score = (p.score_a = m.score_a AND p.score_b = m.score_b AND m.score_a <> m.score_b),
    good_winner = (
      CASE
        WHEN m.score_a = m.score_b THEN p.score_a = p.score_b
        WHEN m.score_a > m.score_b THEN p.score_a > p.score_b
        ELSE p.score_a < p.score_b
      END
    ),
    points = CASE
      -- Match nul réel : score exact ne compte pas, seul un nul prédit donne 1 pt
      WHEN m.score_a = m.score_b THEN
        CASE WHEN p.score_a = p.score_b THEN 1 ELSE 0 END
      -- Match non-nul : score exact = 3, bonne équipe gagnante = 2, sinon 0
      WHEN p.score_a = m.score_a AND p.score_b = m.score_b THEN 3
      WHEN m.score_a > m.score_b AND p.score_a > p.score_b THEN 2
      WHEN m.score_a < m.score_b AND p.score_a < p.score_b THEN 2
      ELSE 0
    END,
    updated_at = now()
  WHERE p.match_id = _match_id;
END; $function$;