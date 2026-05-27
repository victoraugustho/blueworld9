BEGIN;

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

UPDATE public.teacher_project_assets
SET locale = CASE
  WHEN COALESCE(NULLIF(title_es, ''), '') <> '' AND COALESCE(NULLIF(title_pt, ''), '') = '' THEN 'es'
  ELSE 'pt-BR'
END
WHERE locale IS NULL;

COMMIT;
