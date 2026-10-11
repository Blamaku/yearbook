-- Undo 20261021000000_staff_chart.sql (the answers to the three chart questions are lost).
BEGIN;
DROP VIEW IF EXISTS public.staff_public;
CREATE VIEW public.staff_public WITH (security_invoker = true) AS
  SELECT id, name, title, position, dept, since_year, message, photo_url, created_at,
         category, rank, lead_role, unit, teaches, qualifications
  FROM public.staff_profiles WHERE status = 'approved';
REVOKE ALL ON public.staff_public FROM anon, authenticated;
GRANT SELECT ON public.staff_public TO anon, authenticated;
ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS lead_level, DROP COLUMN IF EXISTS campus, DROP COLUMN IF EXISTS help_with;
COMMIT;
