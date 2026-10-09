-- =====================================================
--  UNDO 20261015000000_home_country.sql
--
--  Puts profiles_public back as it was and removes the country column (the countries students
--  picked are lost). Deploy the previous website first: the new one reads profiles_public.country.
--  If a later migration added more columns to profiles_public, add them back to the view below.
-- =====================================================

BEGIN;

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
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
  p.updated_at
FROM public.profiles p;

REVOKE ALL ON public.profiles_public FROM anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
COMMENT ON VIEW public.profiles_public IS
  'Public projection of profiles: no contact details or birthday; anonymous rows hide reg, photos, county.';

ALTER TABLE public.profiles         DROP COLUMN IF EXISTS country;
ALTER TABLE public.profiles_archive DROP COLUMN IF EXISTS country;

COMMIT;
