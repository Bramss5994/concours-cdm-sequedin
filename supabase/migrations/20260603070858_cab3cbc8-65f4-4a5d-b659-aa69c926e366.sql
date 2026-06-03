
DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_email text := 'admin@pronoscdmilevia.fr';
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = v_email;

  IF v_existing IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', v_email,
      crypt('AdminCDM2026!Keo#9x', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('prenom','Admin','num_paie','ADMIN001','depot','sequedin'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', v_uid::text, now(), now(), now());

    -- profile (in case the trigger didn't fire)
    INSERT INTO public.profiles (id, email, prenom, num_paie, depot, active)
    VALUES (v_uid, v_email, 'Admin', 'ADMIN001', 'sequedin', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    -- ensure admin role
    INSERT INTO public.user_roles (user_id, role) VALUES (v_existing, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
