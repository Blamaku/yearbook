-- Undo 20261031000000_office_admins.sql (every office admin and the whole audit log are removed)
BEGIN;
DROP TABLE IF EXISTS public.office_audit;
DROP TABLE IF EXISTS public.office_admins;
COMMIT;
