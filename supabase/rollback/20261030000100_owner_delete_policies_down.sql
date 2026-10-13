-- Undo 20261030000100_owner_delete_policies.sql (comments, replies and likes readable by everyone again)
BEGIN;
DROP POLICY IF EXISTS "public read" ON public.comments;
CREATE POLICY "public read" ON public.comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON public.comment_replies;
CREATE POLICY "public read" ON public.comment_replies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON public.profile_likes;
CREATE POLICY "public read" ON public.profile_likes FOR SELECT TO anon, authenticated USING (true);
COMMIT;
