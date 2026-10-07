-- =====================================================
--  GLUK YEARBOOK 2026 — SAFE PUBLIC VIEWS  (step 1 of 2)
--
--  Problem: the public key could read EVERY column of profiles (WhatsApp,
--  email, birthday, constituency, current location) and of club_officers
--  (officials' email addresses), including rows marked anonymous.
--
--  This step only ADDS two read-only views. Nothing is taken away yet, so the
--  current website keeps working while the new one is deployed.
--
--    profiles_public       — what anyone may see. Contact details and birthday
--                            are left out; anonymous profiles also hide reg,
--                            photos, county and "what are you up to".
--    club_officers_public  — officials without their email address.
--
--  Private fields are served by the "api" Edge Function to signed-in people
--  (profile.private), and in full to the profile owner and the admin.
--
--  The views run with their owner's rights (security_invoker = false) on
--  purpose: they ARE the public projection, so the base tables can be closed.
--
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) firebase deploy
--         4) 20261007000100_hide_private_fields.sql
--  Undo:  supabase/rollback/20261007000000_public_views_down.sql
--  Safe to run more than once.
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

CREATE OR REPLACE VIEW public.club_officers_public
WITH (security_invoker = false) AS
SELECT o.id, o.club_name, o.officer_name, o.role, o.created_at
FROM public.club_officers o;

REVOKE ALL ON public.profiles_public, public.club_officers_public FROM anon, authenticated;
GRANT SELECT ON public.profiles_public, public.club_officers_public TO anon, authenticated;

COMMENT ON VIEW public.profiles_public IS
  'Public projection of profiles: no contact details or birthday; anonymous rows hide reg, photos, county.';
COMMENT ON VIEW public.club_officers_public IS
  'Public projection of club_officers without officer_email.';

COMMIT;
