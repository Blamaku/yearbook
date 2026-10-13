-- =====================================================
--  GLUK YEARBOOK 2026 — REMOVE DELETED PROFILES FOR GOOD, EVERY NIGHT
--
--  At 00:30 UTC (03:30 in Kisumu) the database asks the api ("purge.run") to remove every profile whose
--  owner deleted it more than 90 days ago, photos included (only the api can delete storage files).
--  The api only does it when the x-purge-secret header matches its PURGE_SECRET. The same secret is kept
--  in Vault as 'purge_secret': it is set once by hand and never written in this file. The bearer key is
--  the public key the website already uses.
--  Undo: supabase/rollback/20261030000300_purge_schedule_down.sql. Safe to run more than once.
-- =====================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-deleted-profiles';
SELECT cron.schedule('purge-deleted-profiles', '30 0 * * *', $job$
  SELECT net.http_post(
    url := 'https://erelegzvgxwxwroqjynw.supabase.co/functions/v1/api',
    body := '{"action":"purge.run"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWxlZ3p2Z3h3eHdyb3FqeW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg0NTksImV4cCI6MjA5MTA0NDQ1OX0.Do1CnX1MxT9-rgT-zvgL92KcP7FRgCDHxKwdx5TYs1s',
      'x-purge-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'purge_secret' LIMIT 1)),
    timeout_milliseconds := 60000)
$job$);

COMMIT;
