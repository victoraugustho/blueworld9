BEGIN;

DROP INDEX IF EXISTS teacher_classes_unique_teacher_name_year_idx;

CREATE INDEX IF NOT EXISTS teacher_classes_teacher_year_name_idx
  ON public.teacher_classes(teacher_id, school_year, name);

ALTER TABLE public.teacher_schedules
  ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS teacher_schedules_teacher_class_id_idx
  ON public.teacher_schedules(teacher_id, class_id);

ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL;

UPDATE public.teacher_lesson_logs l
SET class_id = s.class_id
FROM public.teacher_schedules s
WHERE l.schedule_id = s.id
  AND l.class_id IS NULL
  AND s.class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS teacher_lesson_logs_class_id_idx
  ON public.teacher_lesson_logs(class_id);

ALTER TABLE public.teacher_lesson_logs
  DROP CONSTRAINT IF EXISTS teacher_lesson_logs_teacher_id_class_label_lesson_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS teacher_lesson_logs_teacher_scope_lesson_unique_idx
  ON public.teacher_lesson_logs(
    teacher_id,
    COALESCE(class_id::text, schedule_id::text, class_label),
    lesson_number
  );

ALTER TABLE public.teacher_reminders
  ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL;

ALTER TABLE public.teacher_reminders
  ADD COLUMN IF NOT EXISTS schedule_id UUID NULL REFERENCES public.teacher_schedules(id) ON DELETE SET NULL;

UPDATE public.teacher_reminders r
SET class_id = s.class_id
FROM public.teacher_schedules s
WHERE r.schedule_id = s.id
  AND r.class_id IS NULL
  AND s.class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS teacher_reminders_schedule_id_idx
  ON public.teacher_reminders(schedule_id);

CREATE INDEX IF NOT EXISTS teacher_reminders_class_id_lesson_idx
  ON public.teacher_reminders(teacher_id, class_id, lesson_number);

COMMIT;
