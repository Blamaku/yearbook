-- Undo 20261013000000_quiz_and_traffic.sql: removes the Who's who? leaderboard and the traffic counts.
-- Deletes every score and every counted visit, so back them up first (scripts/backup.mjs) if they matter.
BEGIN;
DROP FUNCTION IF EXISTS public.dev_traffic();
DROP VIEW IF EXISTS public.kyu_leaderboard;
DROP TABLE IF EXISTS public.kyu_board;
DROP TABLE IF EXISTS public.kyu_runs;
DROP TABLE IF EXISTS public.page_views;
COMMIT;
