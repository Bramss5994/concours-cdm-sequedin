-- 1) Stop broadcasting predictions via Realtime (RLS-bypassing leak)
ALTER PUBLICATION supabase_realtime DROP TABLE public.predictions;

-- 2) Lock down SECURITY DEFINER functions that should only run from triggers / admin paths
REVOKE EXECUTE ON FUNCTION public.recompute_match_points(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_prediction_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.matches_after_result() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- has_role(uuid, app_role) is intentionally executable: it is referenced by RLS policies
-- which evaluate as the querying role and need EXECUTE.
