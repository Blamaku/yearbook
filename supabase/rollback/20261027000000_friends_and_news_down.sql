-- Undo 20261027000000_friends_and_news.sql (deletes every friendship, friend event and announcement)
BEGIN;
DROP VIEW IF EXISTS public.announcements_public;
DROP TABLE IF EXISTS public.announcements;
DROP TABLE IF EXISTS public.friend_events;
DROP TABLE IF EXISTS public.friend_links;
COMMIT;
