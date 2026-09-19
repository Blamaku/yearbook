-- =====================================================
--  GLUK YEARBOOK 2026 — SUPABASE FIX (v2)
--
--  Run in: Supabase Dashboard → SQL Editor → Run
--
--  Fixes the "column already exists" error by handling
--  the case where BOTH classYear AND classyear exist.
--  Also adds the critical GRANT permissions that were
--  missing (this is why profiles showed nothing).
-- =====================================================

-- ── STEP 1: Create table if it doesn't exist ────────
CREATE TABLE IF NOT EXISTS profiles (
  id              BIGSERIAL PRIMARY KEY,
  uid             TEXT NOT NULL,
  name            TEXT,
  reg             TEXT,
  dept            TEXT,
  course          TEXT,
  classyear       TEXT,
  county          TEXT,
  constituency    TEXT,
  whatsapp        TEXT,
  email           TEXT,
  bio             TEXT,
  hobbies         TEXT,
  clubs           TEXT[],
  bestmemory      TEXT,
  biggestlesson   TEXT,
  mostlikelyto    TEXT,
  whatareyouto    TEXT,
  photo_url       TEXT,
  photos          TEXT[],
  isanonymous     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 2: Add missing lowercase columns (safe) ────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS classyear     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bestmemory    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS biggestlesson TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mostlikelyto  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatareyouto  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currentcounty    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currentlocation  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS isanonymous   BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photos        TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clubs         TEXT[];

-- ── STEP 3: Merge camelCase columns safely ──────────
-- Handles three scenarios for each column:
--   A) Only camelCase exists  → rename it
--   B) Only lowercase exists  → nothing to do
--   C) BOTH exist             → copy data then drop camelCase
DO $$ BEGIN

  -- classYear / classyear
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='classYear') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='classyear') THEN
      -- Case C: both exist — copy non-null values, then drop camelCase column
      UPDATE profiles SET classyear = "classYear" WHERE classyear IS NULL AND "classYear" IS NOT NULL;
      ALTER TABLE profiles DROP COLUMN "classYear";
      RAISE NOTICE 'classYear merged into classyear and dropped';
    ELSE
      -- Case A: only camelCase — safe to rename
      ALTER TABLE profiles RENAME COLUMN "classYear" TO classyear;
      RAISE NOTICE 'classYear renamed to classyear';
    END IF;
  END IF;

  -- bestMemory / bestmemory
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bestMemory') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bestmemory') THEN
      UPDATE profiles SET bestmemory = "bestMemory" WHERE bestmemory IS NULL AND "bestMemory" IS NOT NULL;
      ALTER TABLE profiles DROP COLUMN "bestMemory";
    ELSE
      ALTER TABLE profiles RENAME COLUMN "bestMemory" TO bestmemory;
    END IF;
  END IF;

  -- biggestLesson / biggestlesson
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='biggestLesson') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='biggestlesson') THEN
      UPDATE profiles SET biggestlesson = "biggestLesson" WHERE biggestlesson IS NULL AND "biggestLesson" IS NOT NULL;
      ALTER TABLE profiles DROP COLUMN "biggestLesson";
    ELSE
      ALTER TABLE profiles RENAME COLUMN "biggestLesson" TO biggestlesson;
    END IF;
  END IF;

  -- mostLikelyTo / mostlikelyto
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mostLikelyTo') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='mostlikelyto') THEN
      UPDATE profiles SET mostlikelyto = "mostLikelyTo" WHERE mostlikelyto IS NULL AND "mostLikelyTo" IS NOT NULL;
      ALTER TABLE profiles DROP COLUMN "mostLikelyTo";
    ELSE
      ALTER TABLE profiles RENAME COLUMN "mostLikelyTo" TO mostlikelyto;
    END IF;
  END IF;

  -- isAnonymous / isanonymous
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='isAnonymous') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='isanonymous') THEN
      UPDATE profiles SET isanonymous = "isAnonymous" WHERE isanonymous IS NULL AND "isAnonymous" IS NOT NULL;
      ALTER TABLE profiles DROP COLUMN "isAnonymous";
    ELSE
      ALTER TABLE profiles RENAME COLUMN "isAnonymous" TO isanonymous;
    END IF;
  END IF;

END $$;

-- ── STEP 4: Disable RLS ──────────────────────────────
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read profiles"     ON profiles;
DROP POLICY IF EXISTS "Insert own profile"       ON profiles;
DROP POLICY IF EXISTS "Update own profile"       ON profiles;
DROP POLICY IF EXISTS "No public delete"         ON profiles;
DROP POLICY IF EXISTS "Allow all from anon key"  ON profiles;

-- ── STEP 5: GRANT permissions (THE CRITICAL FIX) ────
-- Disabling RLS alone is not enough — the anon role
-- still needs explicit table-level GRANT to SELECT.
-- Without this, the anon key returns 0 rows silently.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE profiles_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE profiles_id_seq TO authenticated;

-- ── STEP 6: Storage bucket ───────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('profile-photos','profile-photos',true)
    ON CONFLICT (id) DO UPDATE SET public = true;
    RAISE NOTICE 'profile-photos bucket set to public';
  END IF;
END $$;

-- ── STEP 7: Club posts table ─────────────────────────
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
ALTER TABLE club_posts DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE club_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE club_posts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE club_posts_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE club_posts_id_seq TO authenticated;

-- ── STEP 8: Club files bucket ────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('club-files','club-files',true)
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;
END $$;

-- ── STEP 9: Verify ───────────────────────────────────
-- rowsecurity should be false for both tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public' AND tablename IN ('profiles','club_posts');

-- Grants: should show SELECT/INSERT/UPDATE/DELETE for anon
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name='profiles' AND grantee IN ('anon','authenticated')
ORDER BY grantee, privilege_type;

-- Columns: confirm only lowercase names exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
ORDER BY ordinal_position;

-- =====================================================
--  DATA NORMALISATION & INDEXES
--  Run alongside the main fix above.
--  Trims whitespace from filter columns and adds
--  indexes so filter queries return instantly.
-- =====================================================

-- Trim whitespace from columns used in filters
UPDATE profiles SET dept         = TRIM(dept)         WHERE dept         IS NOT NULL AND dept         != TRIM(dept);
UPDATE profiles SET course       = TRIM(course)       WHERE course       IS NOT NULL AND course       != TRIM(course);
UPDATE profiles SET classyear    = TRIM(classyear)    WHERE classyear    IS NOT NULL AND classyear    != TRIM(classyear);
UPDATE profiles SET county       = TRIM(county)       WHERE county       IS NOT NULL AND county       != TRIM(county);
UPDATE profiles SET constituency = TRIM(constituency) WHERE constituency IS NOT NULL AND constituency != TRIM(constituency);

-- Indexes for the most-used filter columns
CREATE INDEX IF NOT EXISTS idx_profiles_dept      ON profiles(dept);
CREATE INDEX IF NOT EXISTS idx_profiles_course    ON profiles(course);
CREATE INDEX IF NOT EXISTS idx_profiles_classyear ON profiles(classyear);
CREATE INDEX IF NOT EXISTS idx_profiles_county    ON profiles(county);
CREATE INDEX IF NOT EXISTS idx_profiles_uid       ON profiles(uid);

-- club_posts index
CREATE INDEX IF NOT EXISTS idx_club_posts_club ON club_posts(club_name);
CREATE INDEX IF NOT EXISTS idx_club_posts_type ON club_posts(type);

-- Verify final state
SELECT 'profiles rows' AS label, COUNT(*) AS count FROM profiles
UNION ALL
SELECT 'with dept set', COUNT(*) FROM profiles WHERE dept IS NOT NULL AND dept != ''
UNION ALL
SELECT 'with course set', COUNT(*) FROM profiles WHERE course IS NOT NULL AND course != ''
UNION ALL
SELECT 'with clubs set', COUNT(*) FROM profiles WHERE clubs IS NOT NULL;