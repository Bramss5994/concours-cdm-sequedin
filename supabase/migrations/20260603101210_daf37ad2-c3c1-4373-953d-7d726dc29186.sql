-- 1) unit_admins: add a RESTRICTIVE deny-all policy as defense-in-depth.
-- Service role bypasses RLS, so server-side admin flows continue to work.
DROP POLICY IF EXISTS "Deny all client access to unit_admins" ON public.unit_admins;
CREATE POLICY "Deny all client access to unit_admins"
ON public.unit_admins
AS RESTRICTIVE
FOR ALL
TO public, anon, authenticated
USING (false)
WITH CHECK (false);

-- 2) Realtime: restrict topic subscriptions to the app's known channel only.
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Allow listening to all realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can subscribe" ON realtime.messages;

CREATE POLICY "App channels only - authenticated subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('realtime:matches-predictions')
);
