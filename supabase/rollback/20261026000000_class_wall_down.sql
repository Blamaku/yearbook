-- Undo 20261026000000_class_wall.sql (deletes everything on the class wall)
BEGIN;
DROP VIEW IF EXISTS public.grad_posts_wall;
DROP VIEW IF EXISTS public.grad_posts_count;
DROP TABLE IF EXISTS public.grad_posts;
COMMIT;
