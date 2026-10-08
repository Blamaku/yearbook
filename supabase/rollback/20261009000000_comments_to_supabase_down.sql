-- =====================================================
--  UNDO the comments move. First put the old website back and make Firestore
--  comments writable again (firestore.rules from before this change), or nobody
--  can comment. Comments written in Supabase after the move are LOST unless you
--  copy them back to Firestore first: take a backup (node scripts/backup.mjs).
-- =====================================================
BEGIN;
DROP FUNCTION IF EXISTS public.comment_delete_reply(text, text);
DROP FUNCTION IF EXISTS public.comment_add_reply(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.comment_toggle_like(text, text, text);
DROP TABLE IF EXISTS public.comment_replies;
DROP TABLE IF EXISTS public.comments;
-- dev_stats(): re-run supabase/migrations/20261008020000_dev_dashboard.sql for the version without comments
COMMIT;
