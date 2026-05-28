ALTER TABLE public.profiles ADD COLUMN favorite_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);