
-- 1. Admin profile update: prevent id reassignment
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND id = profiles.id);

-- 2. Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_top_scorer_bonuses() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_top_scorer_bonuses() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_winner_bonuses() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_winner_bonuses() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_top_scorer_board() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_top_scorer_board() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_own_email() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_own_email() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_public_profiles() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recompute_match_points(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recompute_match_points(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
