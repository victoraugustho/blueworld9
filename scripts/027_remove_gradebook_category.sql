BEGIN;

ALTER TABLE public.teacher_classes
  DROP COLUMN IF EXISTS category_id;

COMMIT;
