DO $$
BEGIN
  PERFORM cron.unschedule('sync-scores-minutely');
EXCEPTION WHEN others THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-scores-minutely',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://concours-cdm-sequedin.lovable.app/api/public/hooks/sync-scores',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImN5dmdpcWVjdW5jZG9rb2tjb3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTY5NzEsImV4cCI6MjA5NTM5Mjk3MX0.XHnWY51wmKLV558Oib2F-FUhgovzRB6Kgyc-yoiwh6M"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

DO $$
BEGIN
  PERFORM cron.unschedule('sync-topscorers-daily');
EXCEPTION WHEN others THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-topscorers-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://concours-cdm-sequedin.lovable.app/api/public/hooks/sync-topscorers',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInJlZiI6ImN5dmdpcWVjdW5jZG9rb2tjb3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTY5NzEsImV4cCI6MjA5NTM5Mjk3MX0.XHnWY51wmKLV558Oib2F-FUhgovzRB6Kgyc-yoiwh6M"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);