-- =====================================================
--  UNDO phone notifications. Every device that turned notifications on is
--  forgotten (people would have to turn them on again after a re-run).
--  Redeploy an api function without the push actions first, or it will
--  answer "Phone notifications are not set up yet".
-- =====================================================
BEGIN;
DROP TABLE IF EXISTS public.push_events;
DROP TABLE IF EXISTS public.push_subscriptions;
COMMIT;
