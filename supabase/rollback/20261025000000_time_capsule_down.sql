-- Undo 20261025000000_time_capsule.sql (deletes every capsule; photos stay in storage)
BEGIN;
DROP VIEW IF EXISTS public.grad_days_public;
DROP TABLE IF EXISTS public.capsules;
DROP TABLE IF EXISTS public.grad_days;
COMMIT;
