-- =====================================================
--  GLUK YEARBOOK 2026 — STAFF ON THE "SCHOOLS AND OFFICES" CHART (Know your university)
--
--  Three more answers from the staff form, so each school's chart can be drawn: whether someone leads
--  their school or department (or coordinates a programme), their campus, and what students can come
--  to them for. All optional, all public once the admin approves the profile.
--
--  Needs:  20261020000000_staff_details.sql first
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) deploy the website
--  Undo:  supabase/rollback/20261021000000_staff_chart_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS lead_level text CHECK (lead_level IN ('school', 'department', 'programme')),   -- where they sit at the top
  ADD COLUMN IF NOT EXISTS campus     text CHECK (char_length(campus) <= 60),
  ADD COLUMN IF NOT EXISTS help_with  text CHECK (char_length(help_with) <= 160);                        -- "Students come to me for …"

GRANT SELECT (lead_level, campus, help_with) ON TABLE public.staff_profiles TO anon, authenticated;

CREATE OR REPLACE VIEW public.staff_public WITH (security_invoker = true) AS
  SELECT id, name, title, position, dept, since_year, message, photo_url, created_at,
         category, rank, lead_role, unit, teaches, qualifications,
         lead_level, campus, help_with
  FROM public.staff_profiles WHERE status = 'approved';
REVOKE ALL ON public.staff_public FROM anon, authenticated;
GRANT SELECT ON public.staff_public TO anon, authenticated;

COMMIT;
