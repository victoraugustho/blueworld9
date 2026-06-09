BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.teacher_project_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  description TEXT NULL,
  cover_image_url TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_project_categories_locale_check'
  ) THEN
    ALTER TABLE public.teacher_project_categories
      ADD CONSTRAINT teacher_project_categories_locale_check
      CHECK (locale IN ('pt-BR', 'es'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_project_categories_status_check'
  ) THEN
    ALTER TABLE public.teacher_project_categories
      ADD CONSTRAINT teacher_project_categories_status_check
      CHECK (status IN ('active', 'archived'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_project_categories_locale_status_idx
  ON public.teacher_project_categories(locale, status, sort_order, title);

ALTER TABLE public.teacher_projects
  ADD COLUMN IF NOT EXISTS category_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_projects_category_id_fkey'
  ) THEN
    ALTER TABLE public.teacher_projects
      ADD CONSTRAINT teacher_projects_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.teacher_project_categories(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_projects_category_idx
  ON public.teacher_projects(category_id, status, updated_at DESC);

COMMIT;
