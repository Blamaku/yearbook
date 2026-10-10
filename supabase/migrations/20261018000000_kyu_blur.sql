-- =====================================================
--  GLUK YEARBOOK 2026 — WHO'S WHO? BOARD: HIDDEN NAMES STAY, BLURRED
--
--  Until now a player who chose "Hide me" disappeared from the leaderboard. Now their score and
--  time stay on it (so the board shows how many people played), and the page blurs them out.
--
--    kyu_leaderboard   every player the admin has not taken off; for a player who hid their name
--                      the name and photo come back NULL, so the real name never reaches a browser
--
--  The view now runs with its owner's rights (security_invoker = false), like profiles_public:
--  it IS the public projection. kyu_board itself is unchanged (the public key still reads only
--  shown rows there), and the view keeps its grants (SELECT for anon and authenticated).
--
--  Order: 1) deploy the website (it shows a row with no name as a blurred player)  2) this file
--         3) redeploy supabase-api/index.ts (hidden players keep their rank)
--  Undo:  supabase/rollback/20261018000000_kyu_blur_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

CREATE OR REPLACE VIEW public.kyu_leaderboard WITH (security_invoker = false) AS
  SELECT CASE WHEN hidden THEN NULL ELSE name      END AS name,
         CASE WHEN hidden THEN NULL ELSE photo_url END AS photo_url,
         score, seconds, achieved_at, plays
  FROM public.kyu_board WHERE NOT removed
  ORDER BY score DESC, seconds ASC, achieved_at ASC;

COMMENT ON VIEW public.kyu_leaderboard IS
  'Public Who''s who? board: every player not taken off by the admin; name and photo are NULL for players who hid their name.';

COMMIT;
