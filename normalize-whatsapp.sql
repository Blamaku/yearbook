-- =====================================================
--  GLUK YEARBOOK 2026 — TIDY EXISTING WHATSAPP NUMBERS (optional)
--
--  Run in: Supabase Dashboard → SQL Editor → New query → paste the CONTENTS → Run
--
--  The chat buttons already work with old numbers (the website fixes the link when it is opened),
--  so this is only to make the stored numbers consistent: 0712 345 678 -> +254712345678.
--  It only touches clean Kenyan numbers (07…, 01…, 7…, 1… or 254…). Anything else is left alone.
--
--  Do it in this order:
--   1) Run STEP 1 on its own and look at the list.
--   2) Make sure you have taken the safety copy (backup-before-lockdown.sql).
--   3) Run STEP 2.
-- =====================================================

-- STEP 1 — PREVIEW (changes nothing): what would become what
SELECT id, name, whatsapp AS now,
       '+254' || regexp_replace(regexp_replace(whatsapp, '\D', '', 'g'), '^0', '') AS becomes
FROM profiles
WHERE whatsapp IS NOT NULL
  AND whatsapp !~ '^\s*\+'
  AND regexp_replace(whatsapp, '\D', '', 'g') ~ '^0?[17][0-9]{8}$'
ORDER BY id
LIMIT 200;

-- How many rows will change, and how many numbers will be left as they are?
SELECT
  count(*) FILTER (WHERE whatsapp !~ '^\s*\+' AND regexp_replace(whatsapp, '\D', '', 'g') ~ '^(0?[17][0-9]{8}|254[17][0-9]{8})$') AS will_change,
  count(*) FILTER (WHERE whatsapp ~ '^\s*\+254[17][0-9]{8}\s*$')                                                               AS already_ok,
  count(*) FILTER (WHERE whatsapp IS NOT NULL AND whatsapp <> '')                                                                 AS all_numbers
FROM profiles;

-- STEP 2 — THE CHANGE (run only after checking the preview)
UPDATE profiles
SET whatsapp = '+254' || regexp_replace(regexp_replace(whatsapp, '\D', '', 'g'), '^0', '')
WHERE whatsapp IS NOT NULL
  AND whatsapp !~ '^\s*\+'
  AND regexp_replace(whatsapp, '\D', '', 'g') ~ '^0?[17][0-9]{8}$';

UPDATE profiles
SET whatsapp = '+' || regexp_replace(whatsapp, '\D', '', 'g')
WHERE whatsapp IS NOT NULL
  AND whatsapp !~ '^\s*\+'
  AND regexp_replace(whatsapp, '\D', '', 'g') ~ '^254[17][0-9]{8}$';

-- Check again: will_change should now be 0
SELECT count(*) FILTER (WHERE whatsapp !~ '^\s*\+' AND regexp_replace(whatsapp, '\D', '', 'g') ~ '^(0?[17][0-9]{8}|254[17][0-9]{8})$') AS will_change FROM profiles;
