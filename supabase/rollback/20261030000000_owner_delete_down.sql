-- Undo 20261030000000_owner_delete.sql. Run 20261030000100_owner_delete_policies_down.sql first.
-- Profiles their owners deleted stay hidden in profiles_archive (as ordinary archived rows); the admin can restore them.
-- The birthday column stays on profiles_archive: archiving needs it.
BEGIN;

CREATE OR REPLACE VIEW public.letters_wall WITH (security_invoker = true) AS
  SELECT id, author_name, to_kind, body, created_at FROM public.letters
  WHERE on_wall AND NOT hidden AND now() >= timestamptz '2026-11-20 21:00:00+00';

CREATE OR REPLACE VIEW public.kyu_leaderboard WITH (security_invoker = false) AS
  SELECT CASE WHEN hidden THEN NULL::text ELSE name END AS name,
         CASE WHEN hidden THEN NULL::text ELSE photo_url END AS photo_url,
         score, seconds, achieved_at, plays
  FROM public.kyu_board WHERE NOT removed
  ORDER BY score DESC, seconds, achieved_at;

CREATE OR REPLACE VIEW public.chal_board WITH (security_invoker = false) AS
  SELECT team, count(*)::integer AS players, round(avg(score), 1) AS avg_score,
         (count(*) FILTER (WHERE score = 10))::integer AS perfect, max(updated_at) AS last_play
  FROM public.chal_best WHERE team IS NOT NULL AND quiz = team
  GROUP BY team;

CREATE OR REPLACE VIEW public.student_leaders_public WITH (security_invoker = false) AS
  SELECT l.id, CASE WHEN p.id IS NULL THEN NULL::bigint ELSE l.profile_id END AS profile_id,
         l.name, l.org, l.title, l.unit, l.term_from, l.term_to, l.current, l.honour, l.note,
         COALESCE(NULLIF(l.photo_url, ''), p.photo_url) AS photo_url, p.course, p.classyear, l.created_at
  FROM public.student_leaders l LEFT JOIN public.profiles p ON p.id = l.profile_id
  WHERE l.status = 'approved' AND NOT COALESCE(p.isanonymous, false);

DROP FUNCTION IF EXISTS public.purge_ghost(bigint);
DROP FUNCTION IF EXISTS private.is_ghost_uid(text);
DROP FUNCTION IF EXISTS private.is_ghost_profile(bigint);
DROP SCHEMA IF EXISTS private;
DROP INDEX IF EXISTS public.profiles_archive_ghost_uid;
ALTER TABLE public.profiles_archive DROP COLUMN IF EXISTS deleted_by_owner;
ALTER TABLE public.profiles_archive DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.profiles_archive DROP COLUMN IF EXISTS purge_after;

COMMIT;
