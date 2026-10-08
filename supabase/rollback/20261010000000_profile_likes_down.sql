-- =====================================================
--  UNDO profile likes. Every like is LOST: take a backup first
--  (node scripts/backup.mjs). The feed keeps working; its heart
--  goes back to saying "coming soon".
-- =====================================================
BEGIN;
DROP VIEW IF EXISTS public.profile_like_counts;
DROP VIEW IF EXISTS public.profile_comment_counts;
DROP FUNCTION IF EXISTS public.profile_set_like(bigint, text, boolean);
DROP TABLE IF EXISTS public.profile_likes;
COMMIT;
