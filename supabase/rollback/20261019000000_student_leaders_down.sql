-- Undo 20261019000000_student_leaders.sql: removes student leaders completely.
-- Deletes every entry (the roll of past leaders too), so back the table up first if any were added.
BEGIN;
DROP VIEW IF EXISTS public.student_leaders_public;
DROP TABLE IF EXISTS public.student_leaders;
COMMIT;
