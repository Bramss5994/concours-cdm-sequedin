
-- 1) Add INSERT policy on profiles restricting to own id
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 2) Lock down scoring columns on predictions so clients cannot self-award points.
-- Revoke column-level INSERT/UPDATE on points/exact_score/good_winner from client roles;
-- service_role (used by the sync webhook and the SECURITY DEFINER recompute function) keeps full access.
REVOKE INSERT (points, exact_score, good_winner) ON public.predictions FROM authenticated;
REVOKE UPDATE (points, exact_score, good_winner) ON public.predictions FROM authenticated;
REVOKE INSERT (points, exact_score, good_winner) ON public.predictions FROM anon;
REVOKE UPDATE (points, exact_score, good_winner) ON public.predictions FROM anon;
