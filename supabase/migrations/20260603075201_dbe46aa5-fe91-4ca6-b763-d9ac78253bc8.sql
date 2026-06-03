SELECT cron.unschedule('sync-scores-every-15min');

SELECT cron.schedule(
  'sync-scores-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://concours-cdm-sequedin.lovable.app/api/public/hooks/sync-scores',
    headers := '{"Content-Type":"application/json","x-webhook-secret":"95a5cc0dc7a98e97b2f35117e01057df5b1f10d2a5d7106a29262e14dbe65dd1"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);