BEGIN;

CREATE TABLE IF NOT EXISTS public.coordination_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coordination_tasks_status_idx
  ON public.coordination_tasks(status);

CREATE INDEX IF NOT EXISTS coordination_tasks_due_date_idx
  ON public.coordination_tasks(due_date);

DROP TRIGGER IF EXISTS update_coordination_tasks_updated_at ON public.coordination_tasks;
CREATE TRIGGER update_coordination_tasks_updated_at
BEFORE UPDATE ON public.coordination_tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
