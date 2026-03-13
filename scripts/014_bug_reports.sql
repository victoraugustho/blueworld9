CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bug_reports_teacher_idx
  ON public.bug_reports(teacher_id);

CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx
  ON public.bug_reports(created_at DESC);
