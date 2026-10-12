-- =====================================================
--  GLUK YEARBOOK 2026 — LETTERS OPEN ON GRADUATION DAY
--  Blair moved the opening (2026-10-12) from Sunday 15 November to graduation day,
--  Saturday 21 November 2026, 00:00 in Kisumu (2026-11-20 21:00 UTC). Same rules, new time.
--  Also in supabase-api CONFIG.lettersOpenAt and letters.js. Safe to run more than once.
-- =====================================================
BEGIN;
DROP POLICY IF EXISTS "wall once open" ON public.letters;
CREATE POLICY "wall once open" ON public.letters FOR SELECT TO anon, authenticated
  USING (on_wall AND NOT hidden AND now() >= timestamptz '2026-11-20 21:00:00+00');
CREATE OR REPLACE VIEW public.letters_wall WITH (security_invoker = true) AS
  SELECT id, author_name, to_kind, body, created_at
  FROM public.letters WHERE on_wall AND NOT hidden AND now() >= timestamptz '2026-11-20 21:00:00+00';
COMMIT;
