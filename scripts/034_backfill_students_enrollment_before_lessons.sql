BEGIN;

ALTER TABLE public.teacher_class_students
  ADD COLUMN IF NOT EXISTS enrollment_at DATE NULL;

ALTER TABLE public.teacher_class_students
  ALTER COLUMN enrollment_at SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS teacher_class_students_class_active_enrollment_idx
  ON public.teacher_class_students(class_id, active, enrollment_at);

DO $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  WITH class_first_lesson AS (
    SELECT
      lesson_source.class_id,
      MIN(lesson_source.lesson_date)::date AS first_lesson_date
    FROM (
      SELECT class_id, lesson_date::date AS lesson_date
      FROM public.teacher_grade_lessons
      WHERE class_id IS NOT NULL

      UNION ALL

      SELECT class_id, lesson_date::date AS lesson_date
      FROM public.teacher_lesson_logs
      WHERE class_id IS NOT NULL
    ) AS lesson_source
    GROUP BY lesson_source.class_id
  ),
  updated_rows AS (
    UPDATE public.teacher_class_students s
    SET enrollment_at = (cfl.first_lesson_date - INTERVAL '1 day')::date
    FROM class_first_lesson cfl
    WHERE s.class_id = cfl.class_id
      AND s.active = TRUE
      AND (
        s.enrollment_at IS NULL
        OR s.enrollment_at >= cfl.first_lesson_date
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated_count
  FROM updated_rows;

  RAISE NOTICE 'Backfill enrollment_at concluido. Linhas atualizadas: %', v_updated_count;
END
$$;

COMMIT;
