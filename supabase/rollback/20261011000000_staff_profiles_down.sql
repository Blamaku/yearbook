-- Undo 20261011000000_staff_profiles.sql: removes staff profiles completely.
-- Deletes every staff profile, so back the table up first if any were approved.
BEGIN;
DROP VIEW IF EXISTS public.staff_public;
DROP TABLE IF EXISTS public.staff_profiles;
COMMIT;
