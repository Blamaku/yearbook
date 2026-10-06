-- =====================================================
--  GLUK YEARBOOK 2026 — BIRTHDAYS
--  Run in: Supabase Dashboard → SQL Editor → New query → paste the CONTENTS → Run
-- =====================================================

-- Stores only month-and-day ('09-23'), never the year — see the note in the app update for why.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday TEXT;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name='birthday';
