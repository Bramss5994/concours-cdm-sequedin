SELECT created, status_code, content::text
FROM net._http_response
WHERE id = 866
LIMIT 1;