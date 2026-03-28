BEGIN;

-- Backfill de seguranca para manter o comportamento atual:
-- vincula todo conteudo existente a todos os professores.

-- 1) Categorias existentes -> todos os professores
INSERT INTO public.teacher_categories (teacher_id, category_id)
SELECT
  t.id AS teacher_id,
  c.id AS category_id
FROM public.teachers t
CROSS JOIN public.categories c
ON CONFLICT (teacher_id, category_id) DO NOTHING;

-- 2) Turmas (ano) que ja existem em materiais -> todos os professores
INSERT INTO public.teacher_student_years (teacher_id, student_year)
SELECT
  t.id AS teacher_id,
  y.student_year::smallint AS student_year
FROM public.teachers t
CROSS JOIN (
  SELECT DISTINCT m.student_year
  FROM public.materials m
  WHERE m.student_year IS NOT NULL
) y
ON CONFLICT (teacher_id, student_year) DO NOTHING;

-- 3) Materiais com acesso especifico -> todos os professores
INSERT INTO public.material_teacher_access (material_id, teacher_id)
SELECT
  m.id AS material_id,
  t.id AS teacher_id
FROM public.materials m
CROSS JOIN public.teachers t
WHERE COALESCE(m.access_scope, 'all') = 'specific'
ON CONFLICT (material_id, teacher_id) DO NOTHING;

COMMIT;
