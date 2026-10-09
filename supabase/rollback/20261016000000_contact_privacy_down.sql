-- Undo 20261016000000_contact_privacy.sql: minutes readable with the public key again, profiles_public without
-- has_whatsapp/has_email, and the contact lookups log removed (the api then stops limiting lookups).
-- Redeploy the previous api and website first, or the profile page will look for the two missing columns.
BEGIN;
DROP POLICY IF EXISTS "public read" ON public.club_posts;
CREATE POLICY "public read" ON public.club_posts FOR SELECT TO anon, authenticated USING (true);

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT
  p.id, p.uid, p.name, p.dept, p.course, p.classyear,
  COALESCE(p.isanonymous, false)                              AS isanonymous,
  p.clubs, p.bio, p.hobbies, p.bestmemory, p.biggestlesson, p.mostlikelyto,
  CASE WHEN p.isanonymous THEN NULL ELSE p.reg           END AS reg,
  CASE WHEN p.isanonymous THEN NULL ELSE p.photo_url     END AS photo_url,
  CASE WHEN p.isanonymous THEN NULL ELSE p.photos        END AS photos,
  CASE WHEN p.isanonymous THEN NULL ELSE p.county        END AS county,
  CASE WHEN p.isanonymous THEN NULL ELSE p.currentcounty END AS currentcounty,
  CASE WHEN p.isanonymous THEN NULL ELSE p.whatareyouto  END AS whatareyouto,
  (COALESCE(p.birthday, '') <> '')                            AS has_birthday,
  p.created_at, p.updated_at,
  CASE WHEN p.isanonymous THEN NULL ELSE p.country       END AS country
FROM public.profiles p;
REVOKE ALL ON public.profiles_public FROM anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

DROP TABLE IF EXISTS public.contact_views;
COMMIT;
