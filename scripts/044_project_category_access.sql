BEGIN;

ALTER TABLE public.teacher_project_categories
  ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_teacher_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS target_countries TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS target_locales TEXT[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_project_categories_access_scope_check'
  ) THEN
    ALTER TABLE public.teacher_project_categories
      ADD CONSTRAINT teacher_project_categories_access_scope_check
      CHECK (access_scope IN ('all', 'targeted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_project_categories_countries_check'
  ) THEN
    ALTER TABLE public.teacher_project_categories
      ADD CONSTRAINT teacher_project_categories_countries_check
      CHECK (target_countries <@ ARRAY['BR', 'UY', 'PY']::text[]);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_project_categories_locales_check'
  ) THEN
    ALTER TABLE public.teacher_project_categories
      ADD CONSTRAINT teacher_project_categories_locales_check
      CHECK (target_locales <@ ARRAY['pt-BR', 'es']::text[]);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_project_categories_target_teacher_ids_idx
  ON public.teacher_project_categories USING GIN (target_teacher_ids)
  WHERE access_scope = 'targeted';

COMMIT;
