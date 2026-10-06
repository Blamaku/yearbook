-- =====================================================
--  GLUK YEARBOOK 2026 — ADMIN UPGRADE (archive)
--
--  Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--  (paste the CONTENTS of this file, not its name)
--  Safe to run more than once.
--
--  Adds a holding table for archived profiles. Archiving moves a profile here,
--  so it disappears from the yearbook; restoring moves it back with the same id,
--  so its comments and club memberships come back with it.
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles_archive (LIKE profiles);

ALTER TABLE profiles_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles_archive ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_archive_id ON profiles_archive(id);

ALTER TABLE profiles_archive DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles_archive TO anon, authenticated;

-- Verify: you should see one row for profiles_archive, and the two archived_* columns
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='profiles_archive';

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles_archive' AND column_name IN ('archived_at','archived_by');

-- NOTE: like your other tables, this one is open to anyone who has the site's public key.
-- Closing that properly is the separate Supabase lockdown step.
