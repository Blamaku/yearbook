-- =====================================================
--  UNDO the lockdown (emergency only — this re-opens the database
--  to anyone holding the public key). Also set strict: false in app.js.
-- =====================================================
BEGIN;
ALTER TABLE public.profiles         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_archive DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_posts       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_info        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_officers    DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles, public.profiles_archive,
      public.club_posts, public.club_info, public.club_officers TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
CREATE POLICY "profile-photos yndkpx_0" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'profile-photos');
CREATE POLICY "profile-photos yndkpx_1" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'profile-photos');
COMMIT;
