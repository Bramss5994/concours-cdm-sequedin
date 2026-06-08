
-- 1) Fix tautological WITH CHECK on profiles admin update policy
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Revoke EXECUTE from anon on SECURITY DEFINER functions that should require auth.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_own_email() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_top_scorer_bonuses() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_top_scorer_board() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_winner_board() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_winner_bonuses() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recompute_match_points(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.matches_after_result() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_prediction_lock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_top_scorer_lock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_winner_prediction_lock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.touch_unit_admins_updated_at() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_own_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_scorer_bonuses() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_scorer_board() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_winner_board() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_winner_bonuses() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_match_points(uuid) TO service_role;
