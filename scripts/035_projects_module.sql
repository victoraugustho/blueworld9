BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.teacher_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL DEFAULT 'arduino_mblock',
  status TEXT NOT NULL DEFAULT 'draft',
  title_pt TEXT NOT NULL,
  title_es TEXT NOT NULL,
  summary_pt TEXT NULL,
  summary_es TEXT NULL,
  cover_image_url TEXT NULL,
  access_scope TEXT NOT NULL DEFAULT 'all',
  target_teacher_ids UUID[] NULL,
  target_countries TEXT[] NULL,
  target_student_years SMALLINT[] NULL,
  target_class_ids UUID[] NULL,
  published_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_projects_type_check'
  ) THEN
    ALTER TABLE public.teacher_projects
      ADD CONSTRAINT teacher_projects_type_check
      CHECK (project_type IN ('arduino_mblock', 'programming', 'custom'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_projects_status_check'
  ) THEN
    ALTER TABLE public.teacher_projects
      ADD CONSTRAINT teacher_projects_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_projects_access_scope_check'
  ) THEN
    ALTER TABLE public.teacher_projects
      ADD CONSTRAINT teacher_projects_access_scope_check
      CHECK (access_scope IN ('all', 'targeted'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_projects_status_idx
  ON public.teacher_projects(status, published_at DESC);

CREATE INDEX IF NOT EXISTS teacher_projects_created_idx
  ON public.teacher_projects(created_at DESC);

CREATE TABLE IF NOT EXISTS public.teacher_project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  locale TEXT NULL,
  title_pt TEXT NULL,
  title_es TEXT NULL,
  description_pt TEXT NULL,
  description_es TEXT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_project_assets_type_check'
  ) THEN
    ALTER TABLE public.teacher_project_assets
      ADD CONSTRAINT teacher_project_assets_type_check
      CHECK (asset_type IN ('gallery_image', 'document'));
  END IF;
END
$$;

ALTER TABLE public.teacher_project_assets
  ADD COLUMN IF NOT EXISTS locale TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_project_assets_locale_check'
  ) THEN
    ALTER TABLE public.teacher_project_assets
      ADD CONSTRAINT teacher_project_assets_locale_check
      CHECK (locale IS NULL OR locale IN ('pt-BR', 'es'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_project_assets_project_type_idx
  ON public.teacher_project_assets(project_id, asset_type, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.teacher_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
  title_pt TEXT NOT NULL,
  title_es TEXT NOT NULL,
  url TEXT NOT NULL,
  description_pt TEXT NULL,
  description_es TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_project_links_project_idx
  ON public.teacher_project_links(project_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.teacher_project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_project_comments_project_idx
  ON public.teacher_project_comments(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.teacher_project_teacher_notes (
  project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  note TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(project_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_project_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_project_revisions_unique_idx
  ON public.teacher_project_revisions(project_id, revision_number);

CREATE INDEX IF NOT EXISTS teacher_project_revisions_project_idx
  ON public.teacher_project_revisions(project_id, created_at DESC);

COMMIT;
