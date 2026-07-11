
CREATE OR REPLACE FUNCTION public.recompute_match_points(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  final_a_wins boolean := false;
  final_b_wins boolean := false;
  has_after_regular_time boolean := false;
  final_a int;
  final_b int;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;

  IF m.id IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.recomputing_match_points', 'on', true);

  IF m.score_a IS NULL OR m.score_b IS NULL OR NOT m.finished THEN
    UPDATE public.predictions
    SET points = 0,
        exact_score = false,
        good_winner = false,
        updated_at = now()
    WHERE match_id = _match_id;
    RETURN;
  END IF;

  has_after_regular_time := (
    (m.score_a_pen IS NOT NULL AND m.score_b_pen IS NOT NULL AND m.score_a_pen <> m.score_b_pen)
    OR (m.score_a_et IS NOT NULL AND m.score_b_et IS NOT NULL)
  );

  IF m.score_a_et IS NOT NULL AND m.score_b_et IS NOT NULL THEN
    final_a := m.score_a + m.score_a_et;
    final_b := m.score_b + m.score_b_et;
  ELSE
    final_a := m.score_a;
    final_b := m.score_b;
  END IF;

  IF m.score_a_pen IS NOT NULL AND m.score_b_pen IS NOT NULL AND m.score_a_pen <> m.score_b_pen THEN
    final_a_wins := m.score_a_pen > m.score_b_pen;
    final_b_wins := m.score_b_pen > m.score_a_pen;
  ELSIF m.score_a_et IS NOT NULL AND m.score_b_et IS NOT NULL THEN
    final_a_wins := final_a > final_b;
    final_b_wins := final_b > final_a;
  ELSE
    final_a_wins := m.score_a > m.score_b;
    final_b_wins := m.score_b > m.score_a;
  END IF;

  UPDATE public.predictions p
  SET exact_score = (
        (p.score_a = m.score_a AND p.score_b = m.score_b)
        OR (has_after_regular_time AND p.score_a = final_a AND p.score_b = final_b)
      ),
      good_winner = (
        CASE
          WHEN m.score_a = m.score_b THEN p.score_a = p.score_b
          WHEN m.score_a > m.score_b THEN p.score_a > p.score_b
          ELSE p.score_a < p.score_b
        END
      ),
      points = CASE
        WHEN (p.score_a = m.score_a AND p.score_b = m.score_b)
          OR (has_after_regular_time AND p.score_a = final_a AND p.score_b = final_b) THEN 3
        WHEN m.score_a = m.score_b AND p.score_a = p.score_b THEN 1
        WHEN (m.score_a > m.score_b AND p.score_a > p.score_b) OR
             (m.score_a < m.score_b AND p.score_a < p.score_b) THEN 2
        WHEN has_after_regular_time
          AND ((final_a_wins AND p.score_a > p.score_b) OR
               (final_b_wins AND p.score_b > p.score_a)) THEN 2
        ELSE 0
      END,
      updated_at = now()
  FROM public.profiles pr
  WHERE p.match_id = _match_id
    AND pr.id = p.user_id;
END;
$function$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.matches WHERE finished = true LOOP
    PERFORM public.recompute_match_points(r.id);
  END LOOP;
END $$;
