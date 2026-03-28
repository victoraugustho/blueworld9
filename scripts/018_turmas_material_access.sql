BEGIN;

CREATE TABLE IF NOT EXISTS public.teacher_categories (
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, category_id)
);

CREATE INDEX IF NOT EXISTS teacher_categories_teacher_idx
  ON public.teacher_categories(teacher_id);

CREATE INDEX IF NOT EXISTS teacher_categories_category_idx
  ON public.teacher_categories(category_id);

CREATE TABLE IF NOT EXISTS public.teacher_student_years (
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, student_year)
);

CREATE INDEX IF NOT EXISTS teacher_student_years_teacher_idx
  ON public.teacher_student_years(teacher_id);

CREATE INDEX IF NOT EXISTS teacher_student_years_year_idx
  ON public.teacher_student_years(student_year);

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS access_scope TEXT;

UPDATE public.materials
SET access_scope = 'all'
WHERE access_scope IS NULL;

ALTER TABLE public.materials
  ALTER COLUMN access_scope SET DEFAULT 'all',
  ALTER COLUMN access_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materials_access_scope_check'
  ) THEN
    ALTER TABLE public.materials
      ADD CONSTRAINT materials_access_scope_check
      CHECK (access_scope IN ('all', 'specific'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.material_teacher_access (
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (material_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS material_teacher_access_teacher_idx
  ON public.material_teacher_access(teacher_id);

COMMIT;
