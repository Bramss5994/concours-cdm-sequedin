CREATE TABLE public.players (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text NOT NULL CHECK (position IN ('GK','DF','MF','FW')),
  club text,
  is_top_scorer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX players_team_id_idx ON public.players(team_id);
CREATE INDEX players_name_idx ON public.players(name);

GRANT SELECT ON public.players TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players public read"
  ON public.players FOR SELECT TO public USING (true);

CREATE POLICY "Admins write players"
  ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.top_scorer_predictions (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.top_scorer_predictions TO authenticated;
GRANT ALL ON public.top_scorer_predictions TO service_role;

ALTER TABLE public.top_scorer_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own top scorer prediction"
  ON public.top_scorer_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own top scorer prediction"
  ON public.top_scorer_predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own top scorer prediction"
  ON public.top_scorer_predictions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own top scorer prediction"
  ON public.top_scorer_predictions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage top scorer predictions"
  ON public.top_scorer_predictions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.check_top_scorer_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE first_kick timestamptz;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  SELECT min(kickoff_at) INTO first_kick FROM public.matches;
  IF first_kick IS NOT NULL AND now() >= first_kick THEN
    RAISE EXCEPTION 'Le pronostic meilleur buteur est verrouillé (le tournoi a commencé).';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER top_scorer_predictions_lock
  BEFORE INSERT OR UPDATE ON public.top_scorer_predictions
  FOR EACH ROW EXECUTE FUNCTION public.check_top_scorer_lock();

CREATE OR REPLACE FUNCTION public.get_top_scorer_bonuses()
RETURNS TABLE(user_id uuid, bonus integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE top_id uuid;
BEGIN
  SELECT id INTO top_id FROM public.players WHERE is_top_scorer = true LIMIT 1;
  IF top_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT tsp.user_id, CASE WHEN tsp.player_id = top_id THEN 10 ELSE 0 END
    FROM public.top_scorer_predictions tsp;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_top_scorer_bonuses() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_scorer_bonuses() TO authenticated;