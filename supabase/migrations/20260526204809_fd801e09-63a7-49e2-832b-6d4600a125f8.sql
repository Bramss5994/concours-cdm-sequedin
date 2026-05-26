ALTER TABLE public.profiles RENAME COLUMN nom TO num_paie;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, num_paie)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom',''),
    COALESCE(NEW.raw_user_meta_data->>'num_paie',''));
  RETURN NEW;
END;
$$;