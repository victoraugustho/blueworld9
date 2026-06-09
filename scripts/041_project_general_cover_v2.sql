BEGIN;

UPDATE public.teacher_project_categories
SET
  cover_image_url = '/project-general-cover-v2.webp',
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND (
    (locale = 'pt-BR' AND title = 'Geral')
    OR (locale = 'es' AND title = 'General')
  )
  AND cover_image_url IS DISTINCT FROM '/project-general-cover-v2.webp';

COMMIT;
