-- =====================================================
--  GLUK YEARBOOK 2026 — SAFETY COPY BEFORE THE LOCKDOWN
--
--  Run in: Supabase Dashboard → SQL Editor → New query → paste the CONTENTS of this file → Run
--  (paste the contents, not the file name). Safe to run more than once on the same day.
--
--  It makes a dated copy of each table (backup_profiles_YYYYMMDD, ...) inside your database,
--  and locks the copies so the website's public key cannot read them.
--
--  To bring something back later, e.g.:
--    INSERT INTO profiles SELECT * FROM backup_profiles_20260921 WHERE id = 123;
-- =====================================================

DO $$
DECLARE
  t      text;
  suffix text := to_char(now(), 'YYYYMMDD');
  copy   text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'profiles_archive', 'club_posts', 'club_info', 'club_officers'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      copy := 'backup_' || t || '_' || suffix;
      EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I AS TABLE public.%I', copy, t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', copy);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', copy);
      RAISE NOTICE 'Backed up % as %', t, copy;
    ELSE
      RAISE NOTICE 'Skipped % (table does not exist)', t;
    END IF;
  END LOOP;
END $$;

-- Check: each backup should have the same number of rows as its original
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int AS rows
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'backup\_%' OR table_name IN ('profiles', 'profiles_archive', 'club_posts', 'club_info', 'club_officers'))
ORDER BY table_name;
