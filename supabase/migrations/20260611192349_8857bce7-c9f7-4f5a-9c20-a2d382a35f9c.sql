SELECT net.http_post(
  url := 'https://concours-cdm-sequedin.lovable.app/api/public/hooks/sync-scores',
  headers := '{"Content-Type":"application/json","x-webhook-secret":"95a5cc0dc7a98e97b2f35117e01057df5b1f10d2a5d7106a29262e14dbe65dd1","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImN5dmdpcWVjdW5jZG9rb2tjb3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTY5NzEsImV4cCI6MjA5NTM5Mjk3MX0.XHnWY51wmKLV558Oib2F-FUhgovzRB6Kgyc-yoiwh6M"}'::jsonb,
  body := '{}'::jsonb
);