-- =====================================================
--  UNDO step 1 (public views). Undo step 2 first if it was applied,
--  otherwise the website will have nothing to read.
-- =====================================================
BEGIN;
DROP VIEW IF EXISTS public.profiles_public;
DROP VIEW IF EXISTS public.club_officers_public;
COMMIT;
