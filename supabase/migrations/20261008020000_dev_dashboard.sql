-- =====================================================
--  GLUK YEARBOOK 2026 — DEVELOPER DASHBOARD
--
--  ops_events:  a short diary the backup script and the api function write to
--               ('backup' after every backup run, 'push' after every batch of
--               phone notifications). Server-only, like the push tables.
--  dev_stats(): one call returning the numbers the admin Developer tab shows
--               (database size, storage per bucket, unused photos, counts).
--               Only the server key may run it.
--
--  Order: run this, then redeploy supabase-api/index.ts and the website.
--  Undo:  supabase/rollback/20261008020000_dev_dashboard_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ops_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text        NOT NULL,                     -- 'backup' | 'push'
  ok         boolean     NOT NULL DEFAULT true,
  details    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_events_kind_idx ON public.ops_events (kind, created_at DESC);
ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ops_events FROM anon, authenticated;

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
    'push_devices',  (SELECT count(*) FROM public.push_subscriptions),
    'push_people',   (SELECT count(DISTINCT uid) FROM public.push_subscriptions),
    'storage',       (SELECT coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('files', n, 'bytes', b)), '{}'::jsonb)
                        FROM (SELECT bucket_id, count(*) AS n, sum(bytes) AS b FROM objs GROUP BY bucket_id) s),
    'orphan_photos', (SELECT jsonb_build_object('files', count(*), 'bytes', coalesce(sum(bytes), 0))
                        FROM objs o
                        WHERE o.bucket_id = 'profile-photos'
                          AND o.created_at < now() - interval '1 day'          -- a brand-new upload may not be saved to a profile yet
                          AND NOT EXISTS (SELECT 1 FROM used WHERE used.name = o.name))
  );
$$;

-- Functions are runnable by everyone unless taken away; only the server key keeps it.
REVOKE EXECUTE ON FUNCTION public.dev_stats() FROM PUBLIC, anon, authenticated;

COMMIT;
