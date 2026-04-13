BEGIN;

ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS school_year SMALLINT;

UPDATE public.teacher_lesson_logs
SET school_year = EXTRACT(YEAR FROM lesson_date)::smallint
WHERE school_year IS NULL;

ALTER TABLE public.teacher_lesson_logs
  ALTER COLUMN school_year SET DEFAULT EXTRACT(YEAR FROM NOW())::smallint;

ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS bimester SMALLINT;

UPDATE public.teacher_lesson_logs
SET bimester = CASE
  WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
  WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
  WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
  ELSE 4
END
WHERE bimester IS NULL;

ALTER TABLE public.teacher_lesson_logs
  ALTER COLUMN bimester SET DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_lesson_logs_bimester_check'
  ) THEN
    ALTER TABLE public.teacher_lesson_logs
      ADD CONSTRAINT teacher_lesson_logs_bimester_check
      CHECK (bimester IS NULL OR (bimester BETWEEN 1 AND 4));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_lesson_logs_scope_bimester_idx
  ON public.teacher_lesson_logs(teacher_id, class_id, school_year, bimester, lesson_number DESC);

COMMIT;
