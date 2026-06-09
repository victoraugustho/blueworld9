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

WITH existing_pt AS (
  SELECT id
  FROM public.teacher_project_categories
  WHERE locale = 'pt-BR'
    AND title = 'Geral'
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1
),
inserted_pt AS (
  INSERT INTO public.teacher_project_categories (
    locale,
    status,
    title,
    description,
    cover_image_url,
    sort_order
  )
  SELECT
    'pt-BR',
    'active',
    'Geral',
    'Projetos gerais com Arduino, Micro:Bit, MakeyMakey, MBlock, programação e circuitos.',
    '/project-general-cover-v2.webp',
    0
  WHERE NOT EXISTS (SELECT 1 FROM existing_pt)
  RETURNING id
),
pt AS (
  SELECT id FROM existing_pt
  UNION ALL
  SELECT id FROM inserted_pt
  LIMIT 1
)
UPDATE public.teacher_projects p
SET category_id = (SELECT id FROM pt),
    updated_at = NOW()
WHERE p.category_id IS NULL
  AND COALESCE(p.locale, 'pt-BR') = 'pt-BR'
  AND EXISTS (SELECT 1 FROM pt);

WITH existing_es AS (
  SELECT id
  FROM public.teacher_project_categories
  WHERE locale = 'es'
    AND title = 'General'
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1
),
inserted_es AS (
  INSERT INTO public.teacher_project_categories (
    locale,
    status,
    title,
    description,
    cover_image_url,
    sort_order
  )
  SELECT
    'es',
    'active',
    'General',
    'Proyectos generales con Arduino, Micro:Bit, MakeyMakey, MBlock, programación y circuitos.',
    '/project-general-cover-v2.webp',
    0
  WHERE NOT EXISTS (SELECT 1 FROM existing_es)
  RETURNING id
),
es AS (
  SELECT id FROM existing_es
  UNION ALL
  SELECT id FROM inserted_es
  LIMIT 1
)
UPDATE public.teacher_projects p
SET category_id = (SELECT id FROM es),
    updated_at = NOW()
WHERE p.category_id IS NULL
  AND COALESCE(p.locale, 'pt-BR') = 'es'
  AND EXISTS (SELECT 1 FROM es);

COMMIT;
