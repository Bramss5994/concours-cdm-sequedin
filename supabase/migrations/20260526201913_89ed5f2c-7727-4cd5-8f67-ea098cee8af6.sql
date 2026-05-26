
-- 1) leaderboard as security invoker (Postgres 15+)
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard WITH (security_invoker = true) AS
SELECT
  pr.id AS user_id,
  pr.prenom, pr.nom,
  COALESCE(SUM(p.points),0)::int AS total_points,
  COALESCE(SUM(CASE WHEN p.exact_score THEN 1 ELSE 0 END),0)::int AS exact_scores,
  COALESCE(SUM(CASE WHEN p.good_winner THEN 1 ELSE 0 END),0)::int AS good_winners,
  COUNT(p.id)::int AS predictions_count
FROM public.profiles pr
LEFT JOIN public.predictions p ON p.user_id = pr.id
LEFT JOIN public.matches m ON m.id = p.match_id AND m.finished = true
GROUP BY pr.id, pr.prenom, pr.nom;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- 2) Add search_path to remaining functions
CREATE OR REPLACE FUNCTION public.check_prediction_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE k TIMESTAMPTZ;
BEGIN
  IF public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF now() >= (k - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Pronostics fermés pour ce match (clôture 1h avant le coup d''envoi).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.matches_after_result()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_match_points(NEW.id);
  RETURN NEW;
END; $$;

-- 3) Lock down SECURITY DEFINER functions: only trigger-context / explicit roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_match_points(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_match_points(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
