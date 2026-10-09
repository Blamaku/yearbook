-- Undo 20261012000000_letters.sql: removes letters completely.
-- Deletes every letter, so back the table up first (scripts/backup.mjs) if anyone has written one.
BEGIN;
DROP VIEW IF EXISTS public.letters_wall;
DROP TABLE IF EXISTS public.letters;
COMMIT;
