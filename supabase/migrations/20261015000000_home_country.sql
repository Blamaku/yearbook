-- =====================================================
--  GLUK YEARBOOK 2026 — HOME COUNTRY (international students)
--
--    profiles.country          the country a student comes from, picked when they set up their
--                              profile ('Kenya' unless they choose another; blank on older profiles)
--    profiles_archive.country  the same, so archiving and restoring a profile keeps it
--    profiles_public.country   shown like the home county: hidden on anonymous profiles
--
--  Nothing is taken away, and the current website keeps working before the new one is deployed.
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) deploy the website
--  Undo:  supabase/rollback/20261015000000_home_country_down.sql
--  Note:  any later migration that replaces profiles_public must keep country (right after updated_at).
--  Safe to run more than once.
-- =====================================================

BEGIN;

ALTER TABLE public.profiles         ADD COLUMN IF NOT EXISTS country text CHECK (char_length(country) <= 60);
ALTER TABLE public.profiles_archive ADD COLUMN IF NOT EXISTS country text;

-- Same view as 20261007000000_public_views.sql with country added at the end
-- (a view can only gain columns at the end; its grants stay as they are)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.uid,
  p.name,
  p.dept,
  p.course,
  p.classyear,
  COALESCE(p.isanonymous, false)                              AS isanonymous,
  p.clubs,
  p.bio,
  p.hobbies,
  p.bestmemory,
  p.biggestlesson,
  p.mostlikelyto,
  CASE WHEN p.isanonymous THEN NULL ELSE p.reg           END AS reg,
  CASE WHEN p.isanonymous THEN NULL ELSE p.photo_url     END AS photo_url,
  CASE WHEN p.isanonymous THEN NULL ELSE p.photos        END AS photos,
  CASE WHEN p.isanonymous THEN NULL ELSE p.county        END AS county,
  CASE WHEN p.isanonymous THEN NULL ELSE p.currentcounty END AS currentcounty,
  CASE WHEN p.isanonymous THEN NULL ELSE p.whatareyouto  END AS whatareyouto,
  (COALESCE(p.birthday, '') <> '')                            AS has_birthday,
  p.created_at,
  p.updated_at,
  CASE WHEN p.isanonymous THEN NULL ELSE p.country       END AS country
FROM public.profiles p;

COMMIT;
