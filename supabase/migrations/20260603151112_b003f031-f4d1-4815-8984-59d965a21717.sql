DROP POLICY IF EXISTS "No client access to unit_admins" ON public.unit_admins;
DROP POLICY IF EXISTS "Authenticated receive app realtime topics" ON realtime.messages;