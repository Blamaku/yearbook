-- =====================================================
--  GLUK YEARBOOK 2026 — BASE SCHEMA (structure only, no data)
--
--  The first tables were made by hand in the Supabase dashboard, so no
--  migration created them. This file recreates them so a local copy
--  (`supabase start`) can run the later migrations. Copied from the live
--  database on 2026-10-09; locks, views and newer tables come from the
--  files after this one.
--
--  Safe on the live project: everything is IF NOT EXISTS / ON CONFLICT,
--  so it changes nothing there.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id              bigserial PRIMARY KEY,
  uid             text NOT NULL,
  name            text,
  reg             text,
  dept            text,
  course          text,
  county          text,
  constituency    text,
  whatsapp        text,
  email           text,
  bio             text,
  hobbies         text,
  clubs           text[],
  photo_url       text,
  photos          text[],
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  user_id         uuid REFERENCES auth.users (id),
  isanonymous     boolean DEFAULT false,
  classyear       text,
  bestmemory      text,
  biggestlesson   text,
  mostlikelyto    text,
  whatareyouto    text,
  currentcounty   text,
  currentlocation text,
  birthday        text
);
CREATE INDEX IF NOT EXISTS idx_profiles_uid       ON public.profiles (uid);
CREATE INDEX IF NOT EXISTS idx_profiles_dept      ON public.profiles (dept);
CREATE INDEX IF NOT EXISTS idx_profiles_course    ON public.profiles (course);
CREATE INDEX IF NOT EXISTS idx_profiles_county    ON public.profiles (county);
CREATE INDEX IF NOT EXISTS idx_profiles_classyear ON public.profiles (classyear);

-- Deleted profiles are moved here by the admin (same columns + who/when)
CREATE TABLE IF NOT EXISTS public.profiles_archive (
  id              bigint NOT NULL,
  uid             text NOT NULL,
  name            text,
  reg             text,
  dept            text,
  course          text,
  county          text,
  constituency    text,
  whatsapp        text,
  email           text,
  bio             text,
  hobbies         text,
  clubs           text[],
  photo_url       text,
  photos          text[],
  created_at      timestamptz,
  updated_at      timestamptz,
  user_id         uuid,
  isanonymous     boolean,
  classyear       text,
  bestmemory      text,
  biggestlesson   text,
  mostlikelyto    text,
  whatareyouto    text,
  currentcounty   text,
  currentlocation text,
  archived_at     timestamptz DEFAULT now(),
  archived_by     text
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_archive_id ON public.profiles_archive (id);

CREATE TABLE IF NOT EXISTS public.club_posts (
  id          bigserial PRIMARY KEY,
  club_name   text NOT NULL,
  type        text NOT NULL,
  title       text,
  body        text,
  post_date   date DEFAULT CURRENT_DATE,
  file_urls   text[],
  attendees   text[],
  created_by  text,
  author_name text,
  created_at  timestamptz DEFAULT now(),
  pinned      boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_club_posts_club         ON public.club_posts (club_name);
CREATE INDEX IF NOT EXISTS idx_club_posts_club_created ON public.club_posts (club_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_posts_type         ON public.club_posts (type);

CREATE TABLE IF NOT EXISTS public.club_info (
  club_name        text PRIMARY KEY,
  about            text,
  meeting_days     text,
  meeting_place    text,
  contact_whatsapp text,
  contact_email    text,
  updated_by       text,
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_officers (
  id            bigserial PRIMARY KEY,
  club_name     text NOT NULL,
  officer_email text NOT NULL,
  officer_name  text,
  role          text NOT NULL DEFAULT 'Officer',
  created_at    timestamptz DEFAULT now(),
  UNIQUE (club_name, officer_email)
);
CREATE INDEX IF NOT EXISTS idx_club_officers_club ON public.club_officers (club_name);

-- Storage buckets (both public; size and type limits are set by the lockdown)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('profile-photos', 'profile-photos', true),
  ('club-files',     'club-files',     true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
