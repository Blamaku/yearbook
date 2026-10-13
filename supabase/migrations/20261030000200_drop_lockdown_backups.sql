-- =====================================================
--  GLUK YEARBOOK 2026 — DROP THE 6 OCTOBER LOCKDOWN COPIES
--
--  Five copies taken while the database was locked down on 2026-10-06. They hold everyone's details,
--  and a profile removed for good (20261030000000_owner_delete.sql) must not live on in them.
--  The weekly backups in C:\Users\Admin\GLUK-backups keep older states of the yearbook.
--  This cannot be undone from SQL (see the rollback file). Safe to run more than once.
-- =====================================================
BEGIN;
DROP TABLE IF EXISTS public.backup_profiles_20261006, public.backup_profiles_archive_20261006,
  public.backup_club_info_20261006, public.backup_club_officers_20261006, public.backup_club_posts_20261006;
COMMIT;
