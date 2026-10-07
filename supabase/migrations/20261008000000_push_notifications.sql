-- =====================================================
--  GLUK YEARBOOK 2026 — PHONE NOTIFICATIONS (Web Push)
--
--  push_subscriptions: one row per phone/browser that turned notifications on.
--                      The endpoint is a private address at Google/Apple/Mozilla/
--                      Microsoft; with the two keys it lets the server send that
--                      device a notification. Nobody but the server may read it.
--  push_events:        one row per comment/reply that triggered a push, so the
--                      same one is never sent twice and one person can't flood
--                      others (see notifyPerPerson in supabase-api/index.ts).
--
--  Both tables are server-only: RLS on, no grants, no policies. The "api" Edge
--  Function reads and writes them with the service-role key.
--
--  Order: run this, then redeploy supabase-api/index.ts.
--  Undo:  supabase/rollback/20261008000000_push_notifications_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid          text        NOT NULL,                 -- Firebase uid of the person
  endpoint     text        NOT NULL UNIQUE,
  p256dh       text        NOT NULL,
  auth         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_uid_idx ON public.push_subscriptions (uid, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.push_events (
  key        text        PRIMARY KEY,                -- 'c:<comment id>', 'r:<reply id>', 't:<uid>:<minute>'
  actor_uid  text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_events_actor_idx ON public.push_events (actor_uid, created_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_events        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_subscriptions, public.push_events FROM anon, authenticated;

-- Check: expect no rows (the public key has no access to either table)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('push_subscriptions', 'push_events');

COMMIT;
