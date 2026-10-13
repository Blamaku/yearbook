-- Undo 20261030000300_purge_schedule.sql: the nightly purge stops (the super admin's "Deleted profiles" tab
-- still removes overdue ones whenever it is opened). The extensions stay; nothing else uses them yet.
BEGIN;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-deleted-profiles';
COMMIT;
