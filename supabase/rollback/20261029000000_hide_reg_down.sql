-- Undo 20261029000000_hide_reg.sql (reg numbers become public again, except on anonymous profiles)
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
  CASE WHEN p.isanonymous THEN NULL ELSE p.reg           END AS reg,
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

COMMIT;
