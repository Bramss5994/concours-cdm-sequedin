CREATE TABLE public.winner_predictions (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  initial_team_id uuid NOT NULL REFERENCES public.teams(id),
  final_team_id uuid REFERENCES public.teams(id),
  initial_locked_at timestamptz,
  final_locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.winner_predictions TO authenticated;
GRANT ALL ON public.winner_predictions TO service_role;

ALTER TABLE public.winner_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own winner prediction"
  ON public.winner_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own winner prediction"
  ON public.winner_predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own winner prediction"
  ON public.winner_predictions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own winner prediction"
  ON public.winner_predictions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage winner predictions"
  ON public.winner_predictions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lock rules trigger:
-- - initial pick can only be created/changed before any match has kicked off
-- - final pick can only be set/changed after all group matches finished AND before any KO match kickoff
CREATE OR REPLACE FUNCTION public.check_winner_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  first_kick timestamptz;
  groups_done boolean;
  first_ko timestamptz;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT min(kickoff_at) INTO first_kick FROM public.matches;
  SELECT NOT EXISTS (SELECT 1 FROM public.matches WHERE stage = 'group' AND finished = false) INTO groups_done;
  SELECT min(kickoff_at) INTO first_ko FROM public.matches WHERE stage <> 'group';

  -- initial pick changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.initial_team_id IS DISTINCT FROM OLD.initial_team_id) THEN
    IF first_kick IS NOT NULL AND now() >= first_kick THEN
      RAISE EXCEPTION 'Le choix initial est verrouillé (la Coupe du Monde a déjà commencé).';
    END IF;
  END IF;

  -- final pick changes
  IF TG_OP = 'UPDATE' AND NEW.final_team_id IS DISTINCT FROM OLD.final_team_id THEN
    IF NOT COALESCE(groups_done, false) THEN
      RAISE EXCEPTION 'Le re-vote n''est pas encore ouvert (phases de groupes en cours).';
    END IF;
    IF first_ko IS NOT NULL AND now() >= first_ko THEN
      RAISE EXCEPTION 'Le re-vote est fermé (les phases finales ont commencé).';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER winner_predictions_lock
  BEFORE INSERT OR UPDATE ON public.winner_predictions
  FOR EACH ROW EXECUTE FUNCTION public.check_winner_prediction_lock();