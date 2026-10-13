-- Undo 20261102000000_alumni_records.sql. This DELETES every alumni form that was sent: export them first
-- (office.html › Directorate of External Affairs › Export CSV), and put the previous api version back.
BEGIN;
DROP TABLE IF EXISTS public.alumni_records;
COMMIT;
