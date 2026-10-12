-- =====================================================
--  GLUK YEARBOOK 2026 — GLOW UP: THEN VS NOW (graduation week, day 2)
--
--    glowups        one per graduate: a first-year ("then") photo, a photo from now, a caption
--    glowups_wall   the public gallery: empty until Monday 16 November 2026, 00:00 in Kisumu
--                   (2026-11-15 21:00 UTC); name and course come live from the profile
--    glowups_count  how many glow-ups are sealed so far (a number only), for the countdown
--
--  Only Class of 2026 graduates with a named (not anonymous) profile can add one, through the api.
--  Nobody but the api function reads or writes the table.
--  Order: 1) this file  2) redeploy supabase-api/index.ts  3) deploy the website
--         (the website works before 1 and 2; the page just says Glow Up is being switched on)
--  Undo:  supabase/rollback/20261023000000_glow_up_down.sql
--  Safe to run more than once.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.glowups (
  uid         text        PRIMARY KEY,                  -- the Firebase login: one glow-up each
  profile_id  bigint      NOT NULL UNIQUE,              -- the graduate's yearbook profile
  then_url    text        NOT NULL CHECK (char_length(then_url) <= 600),
  now_url     text        NOT NULL CHECK (char_length(now_url) <= 600),
  then_year   integer     CHECK (then_year BETWEEN 2015 AND 2026),   -- when the "then" photo was taken
  caption     text        NOT NULL DEFAULT '' CHECK (char_length(caption) <= 140),
  hidden      boolean     NOT NULL DEFAULT false,       -- hidden by the admin
  reported    boolean     NOT NULL DEFAULT false,       -- someone asked the admin to look at it
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.glowups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.glowups FROM anon, authenticated;

-- The gallery. security_invoker = false: it reads the table and profiles itself, and shows only these columns
CREATE OR REPLACE VIEW public.glowups_wall WITH (security_invoker = false) AS
  SELECT g.profile_id, p.name, p.course, p.dept, g.then_url, g.now_url, g.then_year, g.caption, g.updated_at
  FROM public.glowups g JOIN public.profiles p ON p.id = g.profile_id
  WHERE NOT g.hidden AND NOT COALESCE(p.isanonymous, false)
    AND now() >= timestamptz '2026-11-15 21:00:00+00';
REVOKE ALL ON public.glowups_wall FROM anon, authenticated;
GRANT SELECT ON public.glowups_wall TO anon, authenticated;
COMMENT ON VIEW public.glowups_wall IS 'Glow Up gallery (glowup.html): empty until 2026-11-15 21:00 UTC; no logins.';

CREATE OR REPLACE VIEW public.glowups_count WITH (security_invoker = false) AS
  SELECT count(*)::int AS n FROM public.glowups WHERE NOT hidden;
REVOKE ALL ON public.glowups_count FROM anon, authenticated;
GRANT SELECT ON public.glowups_count TO anon, authenticated;
COMMENT ON VIEW public.glowups_count IS 'How many glow-ups are sealed so far: a number only.';

COMMIT;
