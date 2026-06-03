-- Table for unit admin accounts (separate authentication from participants)
CREATE TABLE public.unit_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  depot public.depot NOT NULL,
  login_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unit_admins_code_format CHECK (login_code = upper(login_code) AND length(login_code) BETWEEN 3 AND 32)
);

-- Service-role-only table: all reads/writes go through server functions using supabaseAdmin.
-- No grants to anon or authenticated — they have no business touching password hashes.
GRANT ALL ON public.unit_admins TO service_role;

ALTER TABLE public.unit_admins ENABLE ROW LEVEL SECURITY;

-- Deny-all policy as defense in depth (no grants anyway).
CREATE POLICY "No client access to unit_admins"
ON public.unit_admins
FOR ALL
USING (false)
WITH CHECK (false);

-- Reuse existing updated_at trigger function pattern
CREATE OR REPLACE FUNCTION public.touch_unit_admins_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER unit_admins_set_updated_at
BEFORE UPDATE ON public.unit_admins
FOR EACH ROW
EXECUTE FUNCTION public.touch_unit_admins_updated_at();
