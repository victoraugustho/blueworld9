BEGIN;

-- 1) Garantir colunas esperadas no legado de diário.
ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL;

ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS school_year SMALLINT;

ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS bimester SMALLINT;

ALTER TABLE public.teacher_lesson_logs
  ADD COLUMN IF NOT EXISTS has_grades BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) Reconciliar class_id a partir da agenda (fonte mais confiável).
UPDATE public.teacher_lesson_logs l
SET class_id = s.class_id
FROM public.teacher_schedules s
WHERE l.schedule_id = s.id
  AND s.class_id IS NOT NULL
  AND (l.class_id IS NULL OR l.class_id IS DISTINCT FROM s.class_id);

-- 3) Fallback por nome da turma apenas quando o nome for único por professor.
WITH unique_class_name AS (
  SELECT
    c.teacher_id,
    lower(trim(c.name)) AS normalized_name,
    MIN(c.id::text)::uuid AS class_id
  FROM public.teacher_classes c
  GROUP BY c.teacher_id, lower(trim(c.name))
  HAVING COUNT(*) = 1
)
UPDATE public.teacher_lesson_logs l
SET class_id = u.class_id
FROM unique_class_name u
WHERE l.class_id IS NULL
  AND l.teacher_id = u.teacher_id
  AND lower(trim(l.class_label)) = u.normalized_name;

-- 4) Normalizar ano/bimestre no legado.
UPDATE public.teacher_lesson_logs
SET school_year = EXTRACT(YEAR FROM lesson_date)::smallint
WHERE school_year IS NULL;

UPDATE public.teacher_lesson_logs
SET bimester = CASE
  WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
  WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
  WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
  ELSE 4
END
WHERE bimester IS NULL OR bimester < 1 OR bimester > 4;

-- 5) Recriar aulas de notas ausentes a partir do diário.
INSERT INTO public.teacher_grade_lessons (
  teacher_id,
  class_id,
  school_year,
  bimester,
  lesson_number,
  lesson_date,
  has_grades,
  notes
)
SELECT
  l.teacher_id,
  l.class_id,
  l.school_year,
  l.bimester,
  l.lesson_number,
  l.lesson_date,
  COALESCE(l.has_grades, TRUE),
  NULLIF(trim(l.notes), '')
FROM public.teacher_lesson_logs l
WHERE l.class_id IS NOT NULL
ON CONFLICT (class_id, school_year, bimester, lesson_number) DO NOTHING;

-- 6) Sincronizar flag de nota para preservar a intenção original da aula.
UPDATE public.teacher_grade_lessons gl
SET has_grades = COALESCE(l.has_grades, TRUE),
    updated_at = NOW()
FROM public.teacher_lesson_logs l
WHERE l.class_id IS NOT NULL
  AND gl.teacher_id = l.teacher_id
  AND gl.class_id = l.class_id
  AND gl.school_year = l.school_year
  AND gl.bimester = l.bimester
  AND gl.lesson_number = l.lesson_number
  AND gl.has_grades IS DISTINCT FROM COALESCE(l.has_grades, TRUE);

-- 7) Preencher entries faltantes das aulas com nota.
INSERT INTO public.teacher_grade_entries (lesson_id, student_id, attendance)
SELECT
  gl.id,
  s.id,
  'present'
FROM public.teacher_grade_lessons gl
JOIN public.teacher_class_students s
  ON s.class_id = gl.class_id
 AND s.active = TRUE
 AND (
   s.created_at::date <= gl.lesson_date::date
   OR NOT EXISTS (
     SELECT 1
     FROM public.teacher_class_students s_cut
     WHERE s_cut.class_id = gl.class_id
       AND s_cut.active = TRUE
       AND s_cut.created_at::date <= gl.lesson_date::date
   )
 )
WHERE COALESCE(gl.has_grades, TRUE) = TRUE
ON CONFLICT (lesson_id, student_id) DO NOTHING;

COMMIT;

-- Diagnóstico rápido pós-recuperação.
SELECT
  COUNT(*)::int AS total_grade_lessons
FROM public.teacher_grade_lessons;

SELECT
  COUNT(*)::int AS total_grade_entries
FROM public.teacher_grade_entries;

SELECT
  COUNT(*)::int AS lesson_logs_without_class
FROM public.teacher_lesson_logs
WHERE class_id IS NULL;
