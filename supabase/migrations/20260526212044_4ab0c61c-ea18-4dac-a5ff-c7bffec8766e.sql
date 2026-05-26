
-- 1) Profiles: restrict SELECT
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2) Predictions: restrict SELECT
DROP POLICY IF EXISTS "Predictions readable by authenticated" ON public.predictions;

CREATE POLICY "Users read own predictions"
ON public.predictions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read others predictions when match finished"
ON public.predictions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = predictions.match_id AND m.finished = true
  )
);

-- 3) Realtime: require authentication on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages FOR SELECT
TO authenticated
USING (true);

-- 4) Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.recompute_match_points(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.matches_after_result() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_prediction_lock() FROM PUBLIC, anon, authenticated;
