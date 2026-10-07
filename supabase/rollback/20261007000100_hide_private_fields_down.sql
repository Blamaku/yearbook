-- =====================================================
--  UNDO step 2 (emergency only — this makes WhatsApp numbers, emails and
--  birthdays public again). Restores the read access from the 2026-10-06 lockdown.
-- =====================================================
BEGIN;
GRANT SELECT ON TABLE public.profiles, public.club_officers TO anon, authenticated;
DROP POLICY IF EXISTS "public read" ON public.profiles;
DROP POLICY IF EXISTS "public read" ON public.club_officers;
CREATE POLICY "public read" ON public.profiles      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.club_officers FOR SELECT TO anon, authenticated USING (true);
COMMIT;
