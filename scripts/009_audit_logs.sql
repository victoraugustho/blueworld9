CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  actor_email TEXT NULL,
  actor_role TEXT NULL,
  session_id UUID NULL REFERENCES public.teacher_sessions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NULL,
  target_id TEXT NULL,
  request_method TEXT NULL,
  request_path TEXT NULL,
  ip TEXT NULL,
  user_agent TEXT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
  ON public.audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs(action);

CREATE INDEX IF NOT EXISTS audit_logs_target_idx
  ON public.audit_logs(target_type, target_id);
