-- Undo 20261023000000_glow_up.sql (deletes every glow-up; the photos stay in storage)
BEGIN;
DROP VIEW IF EXISTS public.glowups_wall;
DROP VIEW IF EXISTS public.glowups_count;
DROP TABLE IF EXISTS public.glowups;
COMMIT;
