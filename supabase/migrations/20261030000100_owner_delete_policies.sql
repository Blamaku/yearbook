-- =====================================================
--  GLUK YEARBOOK 2026 — HIDE A DELETED PROFILE'S COMMENTS, REPLIES AND LIKES
--
--  Comments, replies and profile likes are read straight from their tables, so the "public read" rules
--  leave out what belongs to a profile its owner deleted (see 20261030000000_owner_delete.sql).
--  The comment and like counts follow by themselves: those views read with the visitor's permissions.
--  Run AFTER 20261030000000_owner_delete.sql (it needs private.is_ghost_uid).
--  Undo: supabase/rollback/20261030000100_owner_delete_policies_down.sql. Safe to run more than once.
-- =====================================================
BEGIN;

DROP POLICY IF EXISTS "public read" ON public.comments;
CREATE POLICY "public read" ON public.comments FOR SELECT TO anon, authenticated
  USING (NOT private.is_ghost_uid(author_uid) AND NOT private.is_ghost_profile(profile_id));

DROP POLICY IF EXISTS "public read" ON public.comment_replies;
CREATE POLICY "public read" ON public.comment_replies FOR SELECT TO anon, authenticated
  USING (NOT private.is_ghost_uid(author_uid));

DROP POLICY IF EXISTS "public read" ON public.profile_likes;
CREATE POLICY "public read" ON public.profile_likes FOR SELECT TO anon, authenticated
  USING (NOT private.is_ghost_uid(uid));

COMMIT;
