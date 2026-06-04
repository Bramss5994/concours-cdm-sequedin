REVOKE EXECUTE ON FUNCTION public.get_winner_bonuses() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_winner_bonuses() TO authenticated;