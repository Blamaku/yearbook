-- =====================================================
--  GLUK YEARBOOK 2026 — DATABASE LOCKDOWN
--
--  Before: row-level security was OFF and the public (anon) key could
--  read, insert, update, delete and TRUNCATE every table.
--  After:  the public key can only READ the yearbook. Every change goes
--          through the "api" Edge Function, which checks the Firebase
--          login and uses the server-side key.
--
--  Order: 1) run backup-before-lockdown.sql
--         2) redeploy supabase-api/index.ts (adds admin.archive.list)
--         3) run this file
--  Undo:  supabase/rollback/20261006000000_lockdown_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

-- 1) Nobody but the server may write. Read access is granted back below.
REVOKE ALL ON TABLE public.profiles, public.profiles_archive,
                    public.club_posts, public.club_info, public.club_officers
  FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2) Turn row-level security on everywhere
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_info        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_officers    ENABLE ROW LEVEL SECURITY;

-- 3) Old policies relied on Supabase Auth (auth.uid()), which this app does not use
DROP POLICY IF EXISTS "Anyone can view profiles"           ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 4) Public read of the live yearbook (same as today). profiles_archive gets
--    no grant and no policy: only the server (admin.archive.list) can read it.
GRANT SELECT ON TABLE public.profiles, public.club_posts, public.club_info, public.club_officers
  TO anon, authenticated;

DROP POLICY IF EXISTS "public read" ON public.profiles;
DROP POLICY IF EXISTS "public read" ON public.club_posts;
DROP POLICY IF EXISTS "public read" ON public.club_info;
DROP POLICY IF EXISTS "public read" ON public.club_officers;
CREATE POLICY "public read" ON public.profiles      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.club_posts    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.club_info     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.club_officers FOR SELECT TO anon, authenticated USING (true);

-- 5) Storage: uploads now use one-time signed slots from the api function,
--    so the public key needs no upload or list rights. Public buckets still
--    serve files by their public URL without any policy.
DROP POLICY IF EXISTS "profile-photos yndkpx_0" ON storage.objects;   -- anon could list every file
DROP POLICY IF EXISTS "profile-photos yndkpx_1" ON storage.objects;   -- anon could upload anything

UPDATE storage.buckets
   SET file_size_limit = 6 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
 WHERE id = 'profile-photos';
UPDATE storage.buckets
   SET file_size_limit = 12 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf',
                                  'application/msword',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
 WHERE id = 'club-files';

-- 6) Backup copies (from backup-before-lockdown.sql) must never be public
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'backup\_%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;

-- Verify: every row should say rls = true; only SELECT for anon (none on profiles_archive)
SELECT c.relname AS tbl, c.relrowsecurity AS rls,
       (SELECT string_agg(privilege_type, ',') FROM information_schema.role_table_grants g
         WHERE g.table_schema = 'public' AND g.table_name = c.relname AND g.grantee = 'anon') AS anon_privs
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;
