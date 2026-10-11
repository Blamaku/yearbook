-- Undo 20261020000000_staff_details.sql: back to the plain staff profile (the new answers are lost).
BEGIN;
-- a view's columns can only be dropped by recreating it
DROP VIEW IF EXISTS public.staff_public;
CREATE VIEW public.staff_public WITH (security_invoker = true) AS
  SELECT id, name, title, position, dept, since_year, message, photo_url, created_at
  FROM public.staff_profiles WHERE status = 'approved';
REVOKE ALL ON public.staff_public FROM anon, authenticated;
GRANT SELECT ON public.staff_public TO anon, authenticated;
ALTER TABLE public.staff_profiles
  DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS rank, DROP COLUMN IF EXISTS lead_role,
  DROP COLUMN IF EXISTS unit, DROP COLUMN IF EXISTS teaches, DROP COLUMN IF EXISTS qualifications;
COMMIT;
