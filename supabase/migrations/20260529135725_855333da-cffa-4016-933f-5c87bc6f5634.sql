
-- 1. Restrict profile SELECT so emails are not exposed to every signed-in user
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Expose only the public-facing fields used by the leaderboard via a SECURITY INVOKER view
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT id, prenom, num_paie, active
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- The view runs as the caller, so we need a permissive SELECT policy on the underlying
-- table limited to the non-sensitive columns. We do this by adding a second policy that
-- the view relies on. PostgREST will still enforce column-level privileges.
CREATE POLICY "Public profile fields readable"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Revoke column-level SELECT on sensitive columns from authenticated so direct
-- table queries cannot read them, while the policy above still permits SELECT on
-- the remaining columns (used by the view).
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, prenom, num_paie, active, favorite_team_id, created_at) ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
-- Re-grant the write privileges (REVOKE above only removed SELECT, but be explicit)

-- Now restrict so only owner / admin can read email + num_paie via direct table query:
-- We override by removing the broad column grants and re-granting per-column.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, prenom, active, favorite_team_id, created_at) ON public.profiles TO authenticated;

-- Owner/admin still need to read their own email + num_paie. Add a policy and
-- grant the email/num_paie columns conditionally is not possible at column level,
-- so we keep email/num_paie readable only through a dedicated function or by
-- the view for num_paie. Email is owner-only via this function:
CREATE OR REPLACE FUNCTION public.get_own_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_own_email() TO authenticated;

-- Re-grant email column to authenticated but the policy "Users read own profile"
-- combined with "Public profile fields readable" makes any SELECT on public.profiles
-- legal. We need to drop the permissive "Public profile fields readable" to enforce
-- owner-only at row level — column grants are the only barrier for non-sensitive
-- fields used by the view.
DROP POLICY IF EXISTS "Public profile fields readable" ON public.profiles;

-- Final state:
--   * RLS policy: only owner or admin can SELECT rows from profiles.
--   * View public.public_profiles uses security_invoker, so it inherits the
--     caller's RLS — but we need the leaderboard to see all rows. Switch the
--     view to SECURITY DEFINER-style by making it owned by a role that bypasses
--     RLS, or simply expose a SECURITY DEFINER function instead.
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (id uuid, prenom text, num_paie text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, prenom, num_paie, active FROM public.profiles;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;

-- Re-grant column SELECTs on profiles so admin/owner queries via the table keep working
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3. Scope the realtime.messages SELECT policy to topics the app actually uses
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;

CREATE POLICY "Authenticated receive app realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'realtime:%'
);
