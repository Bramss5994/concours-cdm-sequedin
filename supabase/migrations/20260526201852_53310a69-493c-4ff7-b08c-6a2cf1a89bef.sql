
-- =========== ROLES ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom TEXT NOT NULL DEFAULT '',
  nom TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom',''),
    COALESCE(NEW.raw_user_meta_data->>'nom',''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== TEAMS ===========
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,           -- ISO code for flag (e.g. 'fr')
  name TEXT NOT NULL,                  -- French name
  group_letter TEXT                    -- A..L (12 groups)
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins write teams" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== MATCHES ===========
CREATE TYPE public.match_stage AS ENUM ('group','r32','r16','qf','sf','third','final');

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage public.match_stage NOT NULL,
  group_letter TEXT,
  matchday INT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  stadium TEXT,
  team_a_id UUID REFERENCES public.teams(id),
  team_b_id UUID REFERENCES public.teams(id),
  team_a_placeholder TEXT,            -- e.g. "1A" / "Winner M49"
  team_b_placeholder TEXT,
  score_a INT,
  score_b INT,
  winner_team_id UUID REFERENCES public.teams(id),   -- for KO ties
  finished BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches public read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins write matches" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== PREDICTIONS ===========
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  score_a INT NOT NULL,
  score_b INT NOT NULL,
  winner_team_id UUID REFERENCES public.teams(id),
  points INT NOT NULL DEFAULT 0,
  exact_score BOOLEAN NOT NULL DEFAULT false,
  good_winner BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Predictions readable by authenticated" ON public.predictions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own predictions" ON public.predictions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own predictions" ON public.predictions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own predictions" ON public.predictions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage predictions" ON public.predictions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Block predictions edits past lock time (1h before kickoff) via trigger
CREATE OR REPLACE FUNCTION public.check_prediction_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE k TIMESTAMPTZ;
BEGIN
  IF public.has_role(auth.uid(),'admin') THEN
    RETURN NEW;
  END IF;
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF now() >= (k - INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Pronostics fermés pour ce match (clôture 1h avant le coup d''envoi).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_prediction_lock
BEFORE INSERT OR UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.check_prediction_lock();

-- =========== SCORING ===========
-- Rules: 3 pts exact score, 2 pts right winner/draw, 0 otherwise.
-- Recompute all predictions for one match after the result is set.
CREATE OR REPLACE FUNCTION public.recompute_match_points(_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m RECORD;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.score_a IS NULL OR m.score_b IS NULL OR NOT m.finished THEN
    UPDATE public.predictions SET points = 0, exact_score = false, good_winner = false
      WHERE match_id = _match_id;
    RETURN;
  END IF;

  UPDATE public.predictions p SET
    exact_score = (p.score_a = m.score_a AND p.score_b = m.score_b),
    good_winner = (
      CASE
        WHEN m.score_a = m.score_b THEN p.score_a = p.score_b
        WHEN m.score_a > m.score_b THEN p.score_a > p.score_b
        ELSE p.score_a < p.score_b
      END
    ),
    points = CASE
      WHEN p.score_a = m.score_a AND p.score_b = m.score_b THEN 3
      WHEN (m.score_a = m.score_b AND p.score_a = p.score_b)
        OR (m.score_a > m.score_b AND p.score_a > p.score_b)
        OR (m.score_a < m.score_b AND p.score_a < p.score_b) THEN 2
      ELSE 0
    END,
    updated_at = now()
  WHERE p.match_id = _match_id;
END; $$;

CREATE OR REPLACE FUNCTION public.matches_after_result()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.recompute_match_points(NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_matches_after_result
AFTER UPDATE OF score_a, score_b, finished ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.matches_after_result();

-- =========== LEADERBOARD VIEW ===========
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  pr.id AS user_id,
  pr.prenom, pr.nom,
  COALESCE(SUM(p.points),0)::int AS total_points,
  COALESCE(SUM(CASE WHEN p.exact_score THEN 1 ELSE 0 END),0)::int AS exact_scores,
  COALESCE(SUM(CASE WHEN p.good_winner THEN 1 ELSE 0 END),0)::int AS good_winners,
  COUNT(p.id)::int AS predictions_count
FROM public.profiles pr
LEFT JOIN public.predictions p ON p.user_id = pr.id
LEFT JOIN public.matches m ON m.id = p.match_id AND m.finished = true
GROUP BY pr.id, pr.prenom, pr.nom;

GRANT SELECT ON public.leaderboard TO anon, authenticated;
