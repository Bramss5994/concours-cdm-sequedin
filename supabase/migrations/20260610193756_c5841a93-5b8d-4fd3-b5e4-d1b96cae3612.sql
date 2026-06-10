
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS api_fixture_id INTEGER,
  ADD COLUMN IF NOT EXISTS goalscorers JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS matches_api_fixture_id_idx ON public.matches(api_fixture_id);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS api_player_id INTEGER,
  ADD COLUMN IF NOT EXISTS goals INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assists INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS players_api_player_id_idx ON public.players(api_player_id);
CREATE INDEX IF NOT EXISTS players_goals_idx ON public.players(goals DESC);
