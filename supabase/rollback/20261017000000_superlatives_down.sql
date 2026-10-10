-- Undo 20261017000000_superlatives.sql: removes the class superlatives completely.
-- Deletes every vote, so back them up first (scripts/backup.mjs) if anyone has voted.
BEGIN;
DROP TABLE IF EXISTS public.sup_votes;
DROP TABLE IF EXISTS public.sup_categories;
COMMIT;
