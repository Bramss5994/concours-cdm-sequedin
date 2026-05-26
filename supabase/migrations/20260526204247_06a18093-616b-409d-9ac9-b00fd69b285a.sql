
REVOKE EXECUTE ON FUNCTION public.recompute_match_points(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_match_points(uuid) TO service_role;
