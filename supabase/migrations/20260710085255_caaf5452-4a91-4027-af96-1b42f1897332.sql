
CREATE OR REPLACE FUNCTION public.recompute_match_points(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  m RECORD;
  final_a_wins boolean := false;
  final_b_wins boolean := false;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;

  IF m.score_a IS NULL OR m.score_b IS NULL OR NOT m.finished THEN
    UPDATE public.predictions SET points = 0, exact_score = false, good_winner = false
      WHERE match_id = _match_id;
    RETURN;
  END IF;

  -- Vainqueur final incluant prolongations & tirs au but (pour l'exception PC Bus)
  IF m.score_a_pen IS NOT NULL AND m.score_b_pen IS NOT NULL AND m.score_a_pen <> m.score_b_pen THEN
    final_a_wins := m.score_a_pen > m.score_b_pen;
    final_b_wins := m.score_b_pen > m.score_a_pen;
  ELSIF m.score_a_et IS NOT NULL AND m.score_b_et IS NOT NULL THEN
    final_a_wins := (m.score_a + m.score_a_et) > (m.score_b + m.score_b_et);
    final_b_wins := (m.score_b + m.score_b_et) > (m.score_a + m.score_a_et);
  ELSE
    final_a_wins := m.score_a > m.score_b;
    final_b_wins := m.score_b > m.score_a;
  END IF;

  UPDATE public.predictions p SET
    exact_score = (p.score_a = m.score_a AND p.score_b = m.score_b),
    good_winner = (
      CASE
        WHEN m.score_a = m.score_b THEN p.score_a = p.score_b
        WHEN m.score_a > m.score_b THEN p.score_a > p.score_b
        ELSE p.score_a < p.score_b
      END
    ),
    points = CASE
      -- 3 pts score exact (temps réglementaire)
      WHEN p.score_a = m.score_a AND p.score_b = m.score_b THEN 3
      -- 1 pt match nul trouvé
      WHEN m.score_a = m.score_b AND p.score_a = p.score_b THEN 1
      -- 2 pts bonne équipe gagnante au temps réglementaire
      WHEN (m.score_a > m.score_b AND p.score_a > p.score_b) OR
           (m.score_a < m.score_b AND p.score_a < p.score_b) THEN 2
      -- Exception PC Bus : bonne équipe gagnante finale (prolong./t.a.b.)
      WHEN (
        (final_a_wins AND p.score_a > p.score_b) OR
        (final_b_wins AND p.score_b > p.score_a)
      ) AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = p.user_id AND pr.depot = 'pc_bus'::public.depot
      ) THEN 2
      ELSE 0
    END,
    updated_at = now()
  WHERE p.match_id = _match_id;
END;
$function$;

-- Recalcule tous les matchs terminés (via matches_after_result -> recompute)
UPDATE public.matches SET score_a = score_a WHERE finished = true;
