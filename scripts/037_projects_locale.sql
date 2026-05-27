BEGIN;

ALTER TABLE public.teacher_projects
  ADD COLUMN IF NOT EXISTS locale TEXT;

ALTER TABLE public.teacher_projects
  ALTER COLUMN locale SET DEFAULT 'pt-BR';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_projects_locale_check'
  ) THEN
    ALTER TABLE public.teacher_projects
      ADD CONSTRAINT teacher_projects_locale_check
      CHECK (locale IS NULL OR locale IN ('pt-BR', 'es'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_projects_locale_status_idx
  ON public.teacher_projects(locale, status, published_at DESC);

COMMIT;
