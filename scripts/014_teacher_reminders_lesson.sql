ALTER TABLE public.teacher_reminders
  ADD COLUMN IF NOT EXISTS class_label TEXT,
  ADD COLUMN IF NOT EXISTS lesson_number INTEGER;

CREATE INDEX IF NOT EXISTS teacher_reminders_class_lesson_idx
  ON public.teacher_reminders(teacher_id, class_label, lesson_number);
