-- =====================================================
--  GLUK YEARBOOK 2026 — RICHER STAFF PROFILES
--
--  The staff form now asks which staff group someone is in, their academic rank (the Kenyan university
--  ladder: Graduate Assistant up to Professor), any leadership role (Dean, Chair of Department…), their
--  department or unit, the units they teach and their qualifications. All optional, all public once the
--  admin approves the profile, like the fields already there.
--
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) deploy the website
--  Undo:  supabase/rollback/20261020000000_staff_details_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS category       text CHECK (char_length(category) <= 40),        -- teaching, leadership, admin, technical …
  ADD COLUMN IF NOT EXISTS rank           text CHECK (char_length(rank) <= 60),            -- Lecturer, Senior Lecturer, Professor …
  ADD COLUMN IF NOT EXISTS lead_role      text CHECK (char_length(lead_role) <= 80),       -- Dean, Chair of Department …
  ADD COLUMN IF NOT EXISTS unit           text CHECK (char_length(unit) <= 120),           -- department or unit, e.g. Clinical Medicine
  ADD COLUMN IF NOT EXISTS teaches        text CHECK (char_length(teaches) <= 300),        -- the units or courses they teach
  ADD COLUMN IF NOT EXISTS qualifications text CHECK (char_length(qualifications) <= 160); -- e.g. PhD (Moi), MSc Nursing

-- Visitors read the new columns too (approved rows only: the existing policy still applies)
GRANT SELECT (category, rank, lead_role, unit, teaches, qualifications) ON TABLE public.staff_profiles TO anon, authenticated;

-- The same view as before, with the new columns at the end
CREATE OR REPLACE VIEW public.staff_public WITH (security_invoker = true) AS
  SELECT id, name, title, position, dept, since_year, message, photo_url, created_at,
         category, rank, lead_role, unit, teaches, qualifications
  FROM public.staff_profiles WHERE status = 'approved';
REVOKE ALL ON public.staff_public FROM anon, authenticated;
GRANT SELECT ON public.staff_public TO anon, authenticated;

COMMIT;
