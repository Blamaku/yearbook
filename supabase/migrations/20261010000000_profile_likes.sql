-- =====================================================
--  GLUK YEARBOOK 2026 — PROFILE LIKES (the heart on the Students feed)
--
--    profile_likes           one row per profile and person who liked it
--    profile_like_counts     likes per profile     } views, so the feed reads a
--    profile_comment_counts  comments per profile  } number, not every row
--
--  Anyone may read them, like comments; nobody but the api function may write,
--  and it does so through profile_set_like. "Set", not "toggle": a double-tap
--  or a retried request can never undo a like by accident.
--
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) deploy the website
--         (the feed works before 1 and 2; the heart just says "coming soon")
--  Undo:  supabase/rollback/20261010000000_profile_likes_down.sql
--  Needs: 20261009000000_comments_to_supabase.sql (the comments table)
--  Safe to run more than once.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_likes (
  profile_id bigint      NOT NULL,                     -- no foreign key: archiving moves a profile out of `profiles` and back
  uid        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, uid)
);
CREATE INDEX IF NOT EXISTS profile_likes_uid_idx ON public.profile_likes (uid, created_at DESC);

-- Public to read (the page shows whether you liked it); written only by the server
ALTER TABLE public.profile_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_likes FROM anon, authenticated;
GRANT SELECT ON TABLE public.profile_likes TO anon, authenticated;
DROP POLICY IF EXISTS "public read" ON public.profile_likes;
CREATE POLICY "public read" ON public.profile_likes FOR SELECT TO anon, authenticated USING (true);

-- Counts for the feed. security_invoker: they read with the caller's own rights, which are read-only
CREATE OR REPLACE VIEW public.profile_like_counts WITH (security_invoker = true) AS
  SELECT profile_id, count(*)::int AS likes FROM public.profile_likes GROUP BY profile_id;
CREATE OR REPLACE VIEW public.profile_comment_counts WITH (security_invoker = true) AS
  SELECT profile_id, count(*)::int AS comments FROM public.comments GROUP BY profile_id;
REVOKE ALL ON public.profile_like_counts, public.profile_comment_counts FROM anon, authenticated;
GRANT SELECT ON public.profile_like_counts, public.profile_comment_counts TO anon, authenticated;

-- Like (p_like true) or unlike (false). `changed` is true only when something really changed,
-- so the owner is told about a like once, not every time someone taps twice.
CREATE OR REPLACE FUNCTION public.profile_set_like(p_profile bigint, p_uid text, p_like boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE n integer;
BEGIN
  IF p_like THEN
    INSERT INTO public.profile_likes (profile_id, uid) VALUES (p_profile, p_uid) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.profile_likes WHERE profile_id = p_profile AND uid = p_uid;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('liked', p_like, 'changed', n > 0,
    'likes', (SELECT count(*) FROM public.profile_likes WHERE profile_id = p_profile));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.profile_set_like(bigint, text, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;
