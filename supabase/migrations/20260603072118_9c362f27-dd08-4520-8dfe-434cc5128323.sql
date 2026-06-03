CREATE OR REPLACE FUNCTION public.get_public_profiles()
 RETURNS TABLE(id uuid, prenom text, num_paie text, active boolean, depot depot)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.prenom, p.num_paie, p.active, p.depot
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p.id AND r.role = 'admin'
  );
$function$;