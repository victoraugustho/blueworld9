BEGIN;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS can_download BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS portal_permissions JSONB NOT NULL DEFAULT '{
    "aulas": true,
    "agenda_notas": true,
    "materiais": true,
    "projetos": true,
    "ia": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS content_permissions JSONB NOT NULL DEFAULT '{
    "aulas": {"mode": "inherit", "category_ids": [], "item_ids": []},
    "materiais": {"mode": "inherit", "category_ids": [], "item_ids": []},
    "projetos": {"mode": "inherit", "category_ids": [], "item_ids": []}
  }'::jsonb;

UPDATE public.teachers
SET portal_permissions = '{
  "aulas": true,
  "agenda_notas": true,
  "materiais": true,
  "projetos": true,
  "ia": true
}'::jsonb
WHERE portal_permissions IS NULL
   OR jsonb_typeof(portal_permissions) <> 'object';

UPDATE public.teachers
SET content_permissions = '{
  "aulas": {"mode": "inherit", "category_ids": [], "item_ids": []},
  "materiais": {"mode": "inherit", "category_ids": [], "item_ids": []},
  "projetos": {"mode": "inherit", "category_ids": [], "item_ids": []}
}'::jsonb
WHERE content_permissions IS NULL
   OR jsonb_typeof(content_permissions) <> 'object';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teachers_portal_permissions_object_check'
      AND conrelid = 'public.teachers'::regclass
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_portal_permissions_object_check
      CHECK (jsonb_typeof(portal_permissions) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teachers_content_permissions_object_check'
      AND conrelid = 'public.teachers'::regclass
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_content_permissions_object_check
      CHECK (jsonb_typeof(content_permissions) = 'object');
  END IF;
END
$$;

COMMIT;
