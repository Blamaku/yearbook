-- Undo 20261101000000_admin_perms.sql: removes the admins table (office_admins was left as it was).
-- Put the previous api version back first, or every admin except the super admin loses access.
BEGIN;
DROP TABLE IF EXISTS public.admins;
COMMIT;
