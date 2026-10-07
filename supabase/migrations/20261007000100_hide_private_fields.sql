-- =====================================================
--  GLUK YEARBOOK 2026 — CLOSE THE RAW TABLES  (step 2 of 2)
--
--  Run ONLY after the new Edge Function and website are live: from here on
--  the public key can no longer read profiles or club_officers directly,
--  only profiles_public and club_officers_public.
--
--  Undo:  supabase/rollback/20261007000100_hide_private_fields_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

REVOKE SELECT ON TABLE public.profiles, public.club_officers FROM anon, authenticated;

DROP POLICY IF EXISTS "public read" ON public.profiles;
DROP POLICY IF EXISTS "public read" ON public.club_officers;

-- Check: anon should read only the two views (expect no rows for the tables)
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
  AND table_name IN ('profiles', 'club_officers', 'profiles_public', 'club_officers_public')
ORDER BY table_name;

COMMIT;
