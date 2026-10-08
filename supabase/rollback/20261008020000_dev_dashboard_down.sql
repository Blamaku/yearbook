-- =====================================================
--  UNDO the developer dashboard tables. The Developer tab will then say it is
--  not set up; the rest of the app is unaffected. Backup and push history is lost.
-- =====================================================
BEGIN;
DROP FUNCTION IF EXISTS public.dev_stats();
DROP TABLE IF EXISTS public.ops_events;
COMMIT;
