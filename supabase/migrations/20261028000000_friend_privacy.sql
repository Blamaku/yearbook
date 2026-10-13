-- =====================================================
--  GLUK YEARBOOK 2026 — WHO CAN SEE MY FRIENDS
--
--    friend_prefs   one row per person who chose: public = true shows their friends on their profile
--                   to signed-in visitors. No row (the default) = only they see their friends.
--
--  Only the api function reads or writes it. Undo: supabase/rollback/20261028000000_friend_privacy_down.sql.
--  Safe to run more than once.
-- =====================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.friend_prefs (
  uid         text        PRIMARY KEY,
  public      boolean     NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.friend_prefs FROM anon, authenticated;

COMMIT;
