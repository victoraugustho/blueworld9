BEGIN;

ALTER TABLE public.teacher_class_students
  ADD COLUMN IF NOT EXISTS enrollment_at DATE NULL;

UPDATE public.teacher_class_students
SET enrollment_at = created_at::date
WHERE enrollment_at IS NULL;

ALTER TABLE public.teacher_class_students
  ALTER COLUMN enrollment_at SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS teacher_class_students_class_active_enrollment_idx
  ON public.teacher_class_students(class_id, active, enrollment_at);

COMMIT;
