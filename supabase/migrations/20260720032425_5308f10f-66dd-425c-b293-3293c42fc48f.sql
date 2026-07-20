ALTER TABLE public.top_scorer_predictions DISABLE TRIGGER USER;

UPDATE public.top_scorer_predictions
SET player_id = '73b2c5ee-17df-4c50-9547-0af02fa9beb9'
WHERE player_id IN ('21f7a94b-d9f7-4314-98be-d331022df741','eb3d4d75-dccd-4209-9e7e-0143133d7b5e')
  AND user_id NOT IN (SELECT user_id FROM public.top_scorer_predictions WHERE player_id='73b2c5ee-17df-4c50-9547-0af02fa9beb9');

DELETE FROM public.top_scorer_predictions
WHERE player_id IN ('21f7a94b-d9f7-4314-98be-d331022df741','eb3d4d75-dccd-4209-9e7e-0143133d7b5e');

ALTER TABLE public.top_scorer_predictions ENABLE TRIGGER USER;

UPDATE public.players SET is_top_scorer = false, goals = 0
WHERE id IN ('21f7a94b-d9f7-4314-98be-d331022df741','eb3d4d75-dccd-4209-9e7e-0143133d7b5e');

UPDATE public.players SET is_top_scorer = true, goals = 10
WHERE id = '73b2c5ee-17df-4c50-9547-0af02fa9beb9';