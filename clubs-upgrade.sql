-- =====================================================
--  GLUK YEARBOOK 2026 — CLUBS UPGRADE
--
--  Run in: Supabase Dashboard → SQL Editor → Run
--  Safe to run more than once.
--
--  Adds:
--   • club_info      – About tab details (description, meeting time/place, contacts)
--   • club_officers  – who may post / edit for each club (assigned in the Admin panel)
--   • club_posts.pinned – lets officials pin a post to the top of the Feed
-- =====================================================

-- 0) Make sure the posts table exists (created earlier by fix-supabase.sql)
CREATE TABLE IF NOT EXISTS club_posts (
  id           BIGSERIAL PRIMARY KEY,
  club_name    TEXT NOT NULL,
  type         TEXT NOT NULL,
  title        TEXT,
  body         TEXT,
  post_date    DATE DEFAULT CURRENT_DATE,
  file_urls    TEXT[],
  attendees    TEXT[],
  created_by   TEXT,
  author_name  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 1) Pinned posts
ALTER TABLE club_posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_club_posts_club_created ON club_posts(club_name, created_at DESC);

-- 2) Club details shown on the About tab (one row per club)
CREATE TABLE IF NOT EXISTS club_info (
  club_name         TEXT PRIMARY KEY,
  about             TEXT,
  meeting_days      TEXT,
  meeting_place     TEXT,
  contact_whatsapp  TEXT,
  contact_email     TEXT,
  updated_by        TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Club officials (added by the admin). Matched to the signed-in user's email.
CREATE TABLE IF NOT EXISTS club_officers (
  id             BIGSERIAL PRIMARY KEY,
  club_name      TEXT NOT NULL,
  officer_email  TEXT NOT NULL,
  officer_name   TEXT,
  role           TEXT NOT NULL DEFAULT 'Officer',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_name, officer_email)
);
CREATE INDEX IF NOT EXISTS idx_club_officers_club ON club_officers(club_name);

-- 4) Same access model as your other tables (see fix-supabase.sql)
ALTER TABLE club_posts    DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_info     DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_officers DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE club_posts    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE club_info     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE club_officers TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE club_posts_id_seq    TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE club_officers_id_seq TO anon, authenticated;

-- 5) Storage bucket for club photos / minutes (already created earlier; harmless if repeated)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('club-files','club-files',true)
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;
END $$;

-- 6) Verify — you should see 3 rows, and "pinned" in the second result
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public' AND tablename IN ('club_posts','club_info','club_officers');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='club_posts' AND column_name='pinned';

-- NOTE: like your other tables, these are open to anyone who has the site's public key.
-- "Officials only" posting is enforced in the app screens. Locking the tables down properly
-- (so it is enforced by the database itself) is the separate Supabase lockdown step.
