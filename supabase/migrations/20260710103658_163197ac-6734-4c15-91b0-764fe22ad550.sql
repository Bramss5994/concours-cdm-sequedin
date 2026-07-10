DROP TRIGGER IF EXISTS matches_after_result_trg ON public.matches;
DROP TRIGGER IF EXISTS trg_check_prediction_lock ON public.predictions;
DROP TRIGGER IF EXISTS trg_predictions_guard_server_fields ON public.predictions;