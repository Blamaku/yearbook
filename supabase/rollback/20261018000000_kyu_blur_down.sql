-- =====================================================
--  UNDO 20261018000000_kyu_blur.sql
--
--  Players who hid their name leave the board again, and the view goes back to the caller's own
--  rights. Redeploy the previous api first, or hidden players are still given a rank.
-- =====================================================

BEGIN;

CREATE OR REPLACE VIEW public.kyu_leaderboard WITH (security_invoker = true) AS
  SELECT name, photo_url, score, seconds, achieved_at, plays
  FROM public.kyu_board WHERE NOT hidden AND NOT removed
  ORDER BY score DESC, seconds ASC, achieved_at ASC;

COMMENT ON VIEW public.kyu_leaderboard IS NULL;

COMMIT;
