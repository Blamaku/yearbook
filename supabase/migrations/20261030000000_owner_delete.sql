-- =====================================================
--  GLUK YEARBOOK 2026 — "DELETE MY PROFILE" WITH 90 DAYS TO CHANGE YOUR MIND
--
--  A profile its owner deletes moves to profiles_archive as a "ghost" (deleted_by_owner) and is removed
--  for good after purge_after (90 days later, set by the api). While it is a ghost:
--    private.is_ghost_uid / is_ghost_profile   say whether a login or profile belongs to a ghost
--    letters_wall, kyu_leaderboard, chal_board, student_leaders_public   leave ghosts out
--  (comments, replies and likes are hidden by 20261030000100_owner_delete_policies.sql;
--   the class wall and Glow Up views already need a live profile)
--    public.purge_ghost(id)   removes a ghost and everything tied to it, for the api only
--  Also gives profiles_archive the birthday column profiles has: archiving failed without it.
--  Undo: supabase/rollback/20261030000000_owner_delete_down.sql. Safe to run more than once.
-- =====================================================
BEGIN;

ALTER TABLE public.profiles_archive ADD COLUMN IF NOT EXISTS birthday text;
ALTER TABLE public.profiles_archive ADD COLUMN IF NOT EXISTS deleted_by_owner boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles_archive ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.profiles_archive ADD COLUMN IF NOT EXISTS purge_after timestamptz;
CREATE INDEX IF NOT EXISTS profiles_archive_ghost_uid ON public.profiles_archive (uid) WHERE deleted_by_owner;

-- In a schema the website's API does not serve, so nobody can call them directly
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_ghost_uid(u text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles_archive a WHERE a.uid = u AND a.deleted_by_owner)
$$;
CREATE OR REPLACE FUNCTION private.is_ghost_profile(p bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles_archive a WHERE a.id = p AND a.deleted_by_owner)
$$;
REVOKE ALL ON FUNCTION private.is_ghost_uid(text), private.is_ghost_profile(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_ghost_uid(text), private.is_ghost_profile(bigint) TO anon, authenticated, service_role;

-- ── public views without ghosts ──
CREATE OR REPLACE VIEW public.letters_wall WITH (security_invoker = true) AS
  SELECT id, author_name, to_kind, body, created_at FROM public.letters
  WHERE on_wall AND NOT hidden AND now() >= timestamptz '2026-11-20 21:00:00+00' AND NOT private.is_ghost_uid(author_uid);

CREATE OR REPLACE VIEW public.kyu_leaderboard WITH (security_invoker = false) AS
  SELECT CASE WHEN hidden THEN NULL::text ELSE name END AS name,
         CASE WHEN hidden THEN NULL::text ELSE photo_url END AS photo_url,
         score, seconds, achieved_at, plays
  FROM public.kyu_board WHERE NOT removed AND NOT private.is_ghost_uid(uid)
  ORDER BY score DESC, seconds, achieved_at;

CREATE OR REPLACE VIEW public.chal_board WITH (security_invoker = false) AS
  SELECT team, count(*)::integer AS players, round(avg(score), 1) AS avg_score,
         (count(*) FILTER (WHERE score = 10))::integer AS perfect, max(updated_at) AS last_play
  FROM public.chal_best WHERE team IS NOT NULL AND quiz = team AND NOT private.is_ghost_uid(uid)
  GROUP BY team;

CREATE OR REPLACE VIEW public.student_leaders_public WITH (security_invoker = false) AS
  SELECT l.id, CASE WHEN p.id IS NULL THEN NULL::bigint ELSE l.profile_id END AS profile_id,
         l.name, l.org, l.title, l.unit, l.term_from, l.term_to, l.current, l.honour, l.note,
         COALESCE(NULLIF(l.photo_url, ''), p.photo_url) AS photo_url, p.course, p.classyear, l.created_at
  FROM public.student_leaders l LEFT JOIN public.profiles p ON p.id = l.profile_id
  WHERE l.status = 'approved' AND NOT COALESCE(p.isanonymous, false)
    AND NOT private.is_ghost_profile(l.profile_id) AND NOT private.is_ghost_uid(l.claimed_by);

-- ── removing a ghost for good (the api removes the photos first, then calls this) ──
-- Everything tied to the login or the profile goes. Kept, without the link: leader entries the admin
-- added (a historical record), and club posts the person wrote as an official (the club's record).
-- The alumni record (when it exists) is separate and is never touched here.
CREATE OR REPLACE FUNCTION public.purge_ghost(p_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g public.profiles_archive;
  out jsonb := '{}'::jsonb;
  n integer;
  touched text[];
BEGIN
  SELECT * INTO g FROM public.profiles_archive WHERE id = p_id AND deleted_by_owner;
  IF NOT FOUND THEN RETURN NULL; END IF;

  DELETE FROM public.comments WHERE author_uid = g.uid OR profile_id = g.id;           -- their replies go with them
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('comments', n);
  WITH d AS (DELETE FROM public.comment_replies WHERE author_uid = g.uid RETURNING comment_id)
    SELECT array_agg(DISTINCT comment_id), count(*) INTO touched, n FROM d;
  out := out || jsonb_build_object('replies', n);
  UPDATE public.comments c SET reply_count = s.n, last_reply_at = s.at, last_reply_by = s.who, last_reply_uid = s.by_uid
    FROM (SELECT c2.id, (SELECT count(*) FROM public.comment_replies r WHERE r.comment_id = c2.id)::integer AS n,
                 l.created_at AS at, l.author_name AS who, l.author_uid AS by_uid
          FROM public.comments c2
          LEFT JOIN LATERAL (SELECT r.created_at, r.author_name, r.author_uid FROM public.comment_replies r
                             WHERE r.comment_id = c2.id ORDER BY r.created_at DESC LIMIT 1) l ON true
          WHERE c2.id = ANY (COALESCE(touched, '{}'))) s
    WHERE c.id = s.id;
  UPDATE public.comments SET liked_by = array_remove(liked_by, g.uid), like_count = GREATEST(0, like_count - 1) WHERE g.uid = ANY (liked_by);
  UPDATE public.comment_replies SET liked_by = array_remove(liked_by, g.uid), like_count = GREATEST(0, like_count - 1) WHERE g.uid = ANY (liked_by);

  DELETE FROM public.profile_likes WHERE uid = g.uid OR profile_id = g.id;   GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('likes', n);
  DELETE FROM public.friend_links WHERE from_uid = g.uid OR to_uid = g.uid;  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('friends', n);
  DELETE FROM public.friend_events WHERE uid = g.uid;
  DELETE FROM public.friend_prefs WHERE uid = g.uid;
  DELETE FROM public.contact_views WHERE uid = g.uid OR profile_id = g.id;
  DELETE FROM public.letters WHERE author_uid = g.uid OR to_uid = g.uid OR to_profile = g.id;  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('letters', n);
  DELETE FROM public.capsules WHERE uid = g.uid;                             GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('capsules', n);
  DELETE FROM public.grad_posts WHERE uid = g.uid OR profile_id = g.id OR tagged_profile = g.id;  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('wall', n);
  DELETE FROM public.glowups WHERE uid = g.uid OR profile_id = g.id;
  DELETE FROM public.sup_votes WHERE voter_uid = g.uid OR profile_id = g.id; GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('votes', n);
  DELETE FROM public.kyu_runs WHERE uid = g.uid;
  DELETE FROM public.kyu_board WHERE uid = g.uid;
  DELETE FROM public.chal_runs WHERE uid = g.uid;
  DELETE FROM public.chal_best WHERE uid = g.uid OR profile_id = g.id;
  DELETE FROM public.push_subscriptions WHERE uid = g.uid;
  DELETE FROM public.push_events WHERE actor_uid = g.uid;
  DELETE FROM public.student_leaders WHERE claimed_by = g.uid;
  UPDATE public.student_leaders SET profile_id = NULL WHERE profile_id = g.id;
  UPDATE public.club_posts SET created_by = NULL WHERE created_by = g.uid;
  UPDATE public.club_info SET updated_by = NULL WHERE updated_by = g.uid;
  DELETE FROM public.ops_events WHERE COALESCE(g.email, '') <> '' AND details ->> 'email' = g.email;
  DELETE FROM public.profiles_archive WHERE id = g.id;
  RETURN out;
END
$$;
REVOKE ALL ON FUNCTION public.purge_ghost(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_ghost(bigint) TO service_role;

COMMIT;
