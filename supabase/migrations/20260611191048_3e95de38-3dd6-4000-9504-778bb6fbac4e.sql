
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS live_status text,
  ADD COLUMN IF NOT EXISTS live_elapsed int,
  ADD COLUMN IF NOT EXISTS live_score_a int,
  ADD COLUMN IF NOT EXISTS live_score_b int,
  ADD COLUMN IF NOT EXISTS live_updated_at timestamptz;

-- Reschedule sync-scores to run every minute
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE command LIKE '%sync-scores%';
  PERFORM cron.schedule(
    'sync-scores-minutely',
    '* * * * *',
    $job$
    SELECT net.http_post(
      url := 'https://concours-cdm-sequedin.lovable.app/api/public/hooks/sync-scores',
      headers := '{"Content-Type":"application/json","x-webhook-secret":"95a5cc0dc7a98e97b2f35117e01057df5b1f10d2a5d7106a29262e14dbe65dd1"}'::jsonb,
      body := '{}'::jsonb
    );
    $job$
  );
END $$;
