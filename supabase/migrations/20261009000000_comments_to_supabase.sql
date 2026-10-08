-- =====================================================
--  GLUK YEARBOOK 2026 — COMMENTS MOVE TO SUPABASE
--
--  Comments and replies lived in Firebase (Firestore), whose free plan stops
--  ALL comment reads for the rest of the day after 50,000. On graduation day
--  that limit is in reach. Here they get their own tables:
--
--    comments         one row per comment on a profile (ids kept from Firestore)
--    comment_replies  one row per reply; deleted with its comment
--
--  Anyone may read them (as before); nobody but the api function may write.
--  Likes and reply counts change through the small functions below, each a
--  single statement, so two people clicking at once can't lose a like.
--
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) make Firestore
--         comments read-only (firestore.rules)  4) node scripts/migrate-comments.mjs
--         5) deploy the website
--  Undo:  supabase/rollback/20261009000000_comments_to_supabase_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.comments (
  id             text        PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{1,40}$'),
  profile_id     bigint      NOT NULL,                 -- no foreign key: archiving moves a profile out of `profiles` and back
  author_uid     text        NOT NULL,
  author_name    text        NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 100),
  text           text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),   -- the api allows 144; room for older entries
  like_count     integer     NOT NULL DEFAULT 0,
  liked_by       text[]      NOT NULL DEFAULT '{}',
  reply_count    integer     NOT NULL DEFAULT 0,
  last_reply_at  timestamptz,
  last_reply_by  text,
  last_reply_uid text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_profile_idx ON public.comments (profile_id, created_at);
CREATE INDEX IF NOT EXISTS comments_author_idx  ON public.comments (author_uid, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS comments_created_idx ON public.comments (created_at DESC);

CREATE TABLE IF NOT EXISTS public.comment_replies (
  id          text        PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{1,40}$'),
  comment_id  text        NOT NULL REFERENCES public.comments (id) ON DELETE CASCADE,
  author_uid  text        NOT NULL,
  author_name text        NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 100),
  text        text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  like_count  integer     NOT NULL DEFAULT 0,
  liked_by    text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comment_replies_comment_idx ON public.comment_replies (comment_id, created_at);
CREATE INDEX IF NOT EXISTS comment_replies_author_idx  ON public.comment_replies (author_uid, created_at DESC);

-- Public to read, like before; written only by the server (no write grants, no write policies)
ALTER TABLE public.comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.comments, public.comment_replies FROM anon, authenticated;
GRANT SELECT ON TABLE public.comments, public.comment_replies TO anon, authenticated;
DROP POLICY IF EXISTS "public read" ON public.comments;
DROP POLICY IF EXISTS "public read" ON public.comment_replies;
CREATE POLICY "public read" ON public.comments        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.comment_replies FOR SELECT TO anon, authenticated USING (true);

-- Like or unlike (p_reply NULL = the comment itself). One UPDATE: the row lock makes it safe under load.
CREATE OR REPLACE FUNCTION public.comment_toggle_like(p_comment text, p_reply text, p_uid text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE n integer; liked boolean;
BEGIN
  IF p_reply IS NULL THEN
    UPDATE public.comments
       SET liked_by   = CASE WHEN p_uid = ANY (liked_by) THEN array_remove(liked_by, p_uid) ELSE array_append(liked_by, p_uid) END,
           like_count = CASE WHEN p_uid = ANY (liked_by) THEN cardinality(liked_by) - 1 ELSE cardinality(liked_by) + 1 END
     WHERE id = p_comment
     RETURNING like_count, p_uid = ANY (liked_by) INTO n, liked;
  ELSE
    UPDATE public.comment_replies
       SET liked_by   = CASE WHEN p_uid = ANY (liked_by) THEN array_remove(liked_by, p_uid) ELSE array_append(liked_by, p_uid) END,
           like_count = CASE WHEN p_uid = ANY (liked_by) THEN cardinality(liked_by) - 1 ELSE cardinality(liked_by) + 1 END
     WHERE id = p_reply AND comment_id = p_comment
     RETURNING like_count, p_uid = ANY (liked_by) INTO n, liked;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('likes', n, 'liked', liked);
END;
$$;

-- Add a reply and bump its comment's counter together. Returns who to notify, or NULL if the comment is gone.
CREATE OR REPLACE FUNCTION public.comment_add_reply(p_id text, p_comment text, p_uid text, p_name text, p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE c record;
BEGIN
  UPDATE public.comments
     SET reply_count = reply_count + 1, last_reply_at = now(), last_reply_by = p_name, last_reply_uid = p_uid
   WHERE id = p_comment
   RETURNING author_uid, profile_id INTO c;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.comment_replies (id, comment_id, author_uid, author_name, text)
  VALUES (p_id, p_comment, p_uid, p_name, p_text);
  RETURN jsonb_build_object('comment_author', c.author_uid, 'profile_id', c.profile_id);
END;
$$;

-- Moderation: remove one reply and recount what is left
CREATE OR REPLACE FUNCTION public.comment_delete_reply(p_comment text, p_reply text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.comment_replies WHERE id = p_reply AND comment_id = p_comment;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.comments c
     SET reply_count = (SELECT count(*) FROM public.comment_replies r WHERE r.comment_id = c.id)
   WHERE c.id = p_comment;
  RETURN true;
END;
$$;

-- The Developer tab's numbers now include comments (they were counted in Firebase before)
CREATE OR REPLACE FUNCTION public.dev_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH used AS (                                         -- photo paths some profile still points at
    SELECT split_part(u, '/object/public/profile-photos/', 2) AS name
    FROM (
      SELECT unnest(coalesce(photos, '{}') || array[photo_url]) AS u FROM public.profiles
      UNION ALL
      SELECT unnest(coalesce(photos, '{}') || array[photo_url]) FROM public.profiles_archive
    ) x
    WHERE u LIKE '%/object/public/profile-photos/%'
  ), objs AS (
    SELECT bucket_id, name, coalesce((metadata->>'size')::bigint, 0) AS bytes, created_at FROM storage.objects
  )
  SELECT jsonb_build_object(
    'db_bytes',      pg_database_size(current_database()),
    'profiles',      (SELECT count(*) FROM public.profiles),
    'profiles_7d',   (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'anonymous',     (SELECT count(*) FROM public.profiles WHERE isanonymous),
    'no_photo',      (SELECT count(*) FROM public.profiles WHERE coalesce(photo_url, '') = ''),
    'archived',      (SELECT count(*) FROM public.profiles_archive),
    'club_posts',    (SELECT count(*) FROM public.club_posts),
    'club_posts_7d', (SELECT count(*) FROM public.club_posts WHERE created_at > now() - interval '7 days'),
    'comments',      (SELECT count(*) FROM public.comments),
    'comments_7d',   (SELECT count(*) FROM public.comments WHERE created_at > now() - interval '7 days'),
    'replies',       (SELECT count(*) FROM public.comment_replies),
    'push_devices',  (SELECT count(*) FROM public.push_subscriptions),
    'push_people',   (SELECT count(DISTINCT uid) FROM public.push_subscriptions),
    'storage',       (SELECT coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('files', n, 'bytes', b)), '{}'::jsonb)
                        FROM (SELECT bucket_id, count(*) AS n, sum(bytes) AS b FROM objs GROUP BY bucket_id) s),
    'orphan_photos', (SELECT jsonb_build_object('files', count(*), 'bytes', coalesce(sum(bytes), 0))
                        FROM objs o
                        WHERE o.bucket_id = 'profile-photos'
                          AND o.created_at < now() - interval '1 day'
                          AND NOT EXISTS (SELECT 1 FROM used WHERE used.name = o.name))
  );
$$;

-- Only the server key may run these
REVOKE EXECUTE ON FUNCTION public.comment_toggle_like(text, text, text)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.comment_add_reply(text, text, text, text, text)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.comment_delete_reply(text, text)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dev_stats()                                        FROM PUBLIC, anon, authenticated;

COMMIT;
