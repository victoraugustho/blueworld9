CREATE TABLE IF NOT EXISTS public.teacher_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_teacher_sessions_teacher
  ON public.teacher_sessions(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_sessions_expires
  ON public.teacher_sessions(expires_at);
