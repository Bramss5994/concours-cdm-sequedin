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

  IF current_setting('app.recomputing_match_points', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(),'admin') THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF now() >= (k - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Pronostics fermés pour ce match (clôture 1h avant le coup d''envoi).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

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
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;

  IF m.id IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.recomputing_match_points', 'on', true);

  IF m.score_a IS NULL OR m.score_b IS NULL OR NOT m.finished THEN
    UPDATE public.predictions SET points = 0, exact_score = false, good_winner = false, updated_at = now()
      WHERE match_id = _match_id;
    RETURN;
  END IF;

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
      WHEN p.score_a = m.score_a AND p.score_b = m.score_b THEN 3
      WHEN m.score_a = m.score_b AND p.score_a = p.score_b THEN 1
      WHEN (m.score_a > m.score_b AND p.score_a > p.score_b) OR
           (m.score_a < m.score_b AND p.score_a < p.score_b) THEN 2
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

ALTER FUNCTION public.recompute_match_points(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.recompute_match_points(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_match_points(uuid) TO service_role;

SELECT public.recompute_match_points('70437533-ffd8-47ac-8e8b-bbf0e7ff87f5'::uuid);