CREATE TABLE IF NOT EXISTS public.teacher_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_label TEXT NOT NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_schedules_teacher_idx
  ON public.teacher_schedules(teacher_id);

CREATE INDEX IF NOT EXISTS teacher_schedules_class_idx
  ON public.teacher_schedules(teacher_id, class_label);

CREATE TABLE IF NOT EXISTS public.teacher_lesson_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  schedule_id UUID NULL REFERENCES public.teacher_schedules(id) ON DELETE SET NULL,
  class_label TEXT NOT NULL,
  lesson_number INTEGER NOT NULL,
  lesson_date DATE NOT NULL,
  notes TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, class_label, lesson_number)
);

CREATE INDEX IF NOT EXISTS teacher_lesson_logs_teacher_idx
  ON public.teacher_lesson_logs(teacher_id);

CREATE INDEX IF NOT EXISTS teacher_lesson_logs_schedule_idx
  ON public.teacher_lesson_logs(schedule_id);

CREATE INDEX IF NOT EXISTS teacher_lesson_logs_date_idx
  ON public.teacher_lesson_logs(lesson_date DESC);

DROP TRIGGER IF EXISTS update_teacher_schedules_updated_at ON public.teacher_schedules;
CREATE TRIGGER update_teacher_schedules_updated_at
BEFORE UPDATE ON public.teacher_schedules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_lesson_logs_updated_at ON public.teacher_lesson_logs;
CREATE TRIGGER update_teacher_lesson_logs_updated_at
BEFORE UPDATE ON public.teacher_lesson_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
