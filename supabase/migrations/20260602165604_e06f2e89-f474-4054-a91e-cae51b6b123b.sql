DROP FUNCTION IF EXISTS public.get_public_profiles();

CREATE TYPE public.depot AS ENUM ('sequedin', 'faidherbe', 'wattrelos', 'pc_bus');

ALTER TABLE public.profiles ADD COLUMN depot public.depot NOT NULL DEFAULT 'sequedin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, num_paie, depot)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom',''),
    COALESCE(NEW.raw_user_meta_data->>'num_paie',''),
    COALESCE((NEW.raw_user_meta_data->>'depot')::public.depot, 'sequedin'::public.depot)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profiles()
 RETURNS TABLE(id uuid, prenom text, num_paie text, active boolean, depot public.depot)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, prenom, num_paie, active, depot FROM public.profiles;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_public_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;