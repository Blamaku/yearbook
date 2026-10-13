-- =====================================================
--  GLUK YEARBOOK 2026 — REGISTRATION NUMBERS ARE PRIVATE
--
--  profiles_public no longer carries anyone's reg number: the column stays (always empty) so pages
--  saved by older versions of the app keep loading. The owner, the super admin and the offices read
--  reg numbers through the api (profile.private and the office dashboards).
--  Undo: supabase/rollback/20261029000000_hide_reg_down.sql. Safe to run more than once.
-- =====================================================
BEGIN;

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
  NULL::text                                                  AS reg,
  CASE WHEN p.isanonymous THEN NULL ELSE p.photo_url     END AS photo_url,
  CASE WHEN p.isanonymous THEN NULL ELSE p.photos        END AS photos,
  CASE WHEN p.isanonymous THEN NULL ELSE p.county        END AS county,
  CASE WHEN p.isanonymous THEN NULL ELSE p.currentcounty END AS currentcounty,
  CASE WHEN p.isanonymous THEN NULL ELSE p.whatareyouto  END AS whatareyouto,
  (COALESCE(p.birthday, '') <> '')                            AS has_birthday,
  p.created_at,
  p.updated_at,
  CASE WHEN p.isanonymous THEN NULL ELSE p.country       END AS country,
  (NOT COALESCE(p.isanonymous, false) AND COALESCE(p.whatsapp, '') <> '') AS has_whatsapp,
  (NOT COALESCE(p.isanonymous, false) AND COALESCE(p.email, '') <> '')    AS has_email
FROM public.profiles p;

COMMENT ON VIEW public.profiles_public IS
  'Public projection of profiles: no reg numbers, contact details or birthday; anonymous rows also hide photos and places.';

COMMIT;
