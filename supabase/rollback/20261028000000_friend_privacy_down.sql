-- Undo 20261028000000_friend_privacy.sql (everyone's friends list goes back to private)
BEGIN;
DROP TABLE IF EXISTS public.friend_prefs;
COMMIT;
