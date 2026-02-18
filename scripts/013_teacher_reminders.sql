CREATE TABLE IF NOT EXISTS public.teacher_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_reminders_teacher_idx
  ON public.teacher_reminders(teacher_id);

CREATE INDEX IF NOT EXISTS teacher_reminders_done_idx
  ON public.teacher_reminders(teacher_id, done);

DROP TRIGGER IF EXISTS update_teacher_reminders_updated_at ON public.teacher_reminders;
CREATE TRIGGER update_teacher_reminders_updated_at
BEFORE UPDATE ON public.teacher_reminders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
