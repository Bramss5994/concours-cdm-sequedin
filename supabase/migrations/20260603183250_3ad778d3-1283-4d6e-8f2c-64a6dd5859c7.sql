CREATE OR REPLACE FUNCTION public.normalize_login_part(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    lower(
      translate(
        coalesce(_value, ''),
        'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝŸýÿ',
        'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYYyy'
      )
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_login_email(_prenom text, _num_paie text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles p
  WHERE p.active = true
    AND public.normalize_login_part(p.num_paie) = public.normalize_login_part(_num_paie)
    AND public.normalize_login_part(p.prenom) = public.normalize_login_part(_prenom)
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.normalize_login_part(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_login_email(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text, text) TO anon, authenticated;