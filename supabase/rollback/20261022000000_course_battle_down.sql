-- Undo 20261022000000_course_battle.sql: removes the course battle and every score in it.
BEGIN;
DROP VIEW IF EXISTS public.chal_board;
DROP TABLE IF EXISTS public.chal_best;
DROP TABLE IF EXISTS public.chal_runs;
COMMIT;
