BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  student_year SMALLINT NULL,
  school_year SMALLINT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::smallint,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_classes_student_year_check
    CHECK (
      student_year IS NULL
      OR (student_year BETWEEN 1 AND 9)
      OR (student_year BETWEEN 103 AND 105)
      OR (student_year BETWEEN 201 AND 203)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_classes_unique_teacher_name_year_idx
  ON public.teacher_classes(teacher_id, school_year, name);

CREATE INDEX IF NOT EXISTS teacher_classes_teacher_year_idx
  ON public.teacher_classes(teacher_id, school_year);

CREATE INDEX IF NOT EXISTS teacher_classes_student_year_idx
  ON public.teacher_classes(student_year);

CREATE TABLE IF NOT EXISTS public.teacher_class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  enrollment_code TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_class_students_class_idx
  ON public.teacher_class_students(class_id);

CREATE INDEX IF NOT EXISTS teacher_class_students_active_idx
  ON public.teacher_class_students(active);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_students_class_enrollment_idx
  ON public.teacher_class_students(class_id, enrollment_code)
  WHERE enrollment_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.teacher_grade_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  school_year SMALLINT NOT NULL,
  bimester SMALLINT NOT NULL CHECK (bimester BETWEEN 1 AND 4),
  lesson_number INTEGER NOT NULL CHECK (lesson_number > 0),
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_grade_lessons_unique_idx
  ON public.teacher_grade_lessons(class_id, school_year, bimester, lesson_number);

CREATE INDEX IF NOT EXISTS teacher_grade_lessons_teacher_class_idx
  ON public.teacher_grade_lessons(teacher_id, class_id);

CREATE INDEX IF NOT EXISTS teacher_grade_lessons_scope_idx
  ON public.teacher_grade_lessons(class_id, school_year, bimester, lesson_date DESC);

CREATE TABLE IF NOT EXISTS public.teacher_grade_entries (
  lesson_id UUID NOT NULL REFERENCES public.teacher_grade_lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.teacher_class_students(id) ON DELETE CASCADE,
  attendance TEXT NOT NULL DEFAULT 'present',
  c1 NUMERIC(4,2) NULL,
  c2 NUMERIC(4,2) NULL,
  c3 NUMERIC(4,2) NULL,
  c4 NUMERIC(4,2) NULL,
  comment TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lesson_id, student_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_grade_entries_attendance_check'
  ) THEN
    ALTER TABLE public.teacher_grade_entries
      ADD CONSTRAINT teacher_grade_entries_attendance_check
      CHECK (attendance IN ('present', 'absent'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_grade_entries_c1_check'
  ) THEN
    ALTER TABLE public.teacher_grade_entries
      ADD CONSTRAINT teacher_grade_entries_c1_check
      CHECK (c1 IS NULL OR (c1 >= 0 AND c1 <= 10));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_grade_entries_c2_check'
  ) THEN
    ALTER TABLE public.teacher_grade_entries
      ADD CONSTRAINT teacher_grade_entries_c2_check
      CHECK (c2 IS NULL OR (c2 >= 0 AND c2 <= 10));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_grade_entries_c3_check'
  ) THEN
    ALTER TABLE public.teacher_grade_entries
      ADD CONSTRAINT teacher_grade_entries_c3_check
      CHECK (c3 IS NULL OR (c3 >= 0 AND c3 <= 10));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_grade_entries_c4_check'
  ) THEN
    ALTER TABLE public.teacher_grade_entries
      ADD CONSTRAINT teacher_grade_entries_c4_check
      CHECK (c4 IS NULL OR (c4 >= 0 AND c4 <= 10));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_grade_entries_student_idx
  ON public.teacher_grade_entries(student_id);

CREATE TABLE IF NOT EXISTS public.teacher_bimester_grades (
  class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.teacher_class_students(id) ON DELETE CASCADE,
  school_year SMALLINT NOT NULL,
  bimester SMALLINT NOT NULL CHECK (bimester BETWEEN 1 AND 4),
  has_exam BOOLEAN NOT NULL DEFAULT FALSE,
  exam_score NUMERIC(4,2) NULL,
  c5_score NUMERIC(4,2) NULL,
  notes TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id, school_year, bimester)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_bimester_grades_exam_check'
  ) THEN
    ALTER TABLE public.teacher_bimester_grades
      ADD CONSTRAINT teacher_bimester_grades_exam_check
      CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 10));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teacher_bimester_grades_c5_check'
  ) THEN
    ALTER TABLE public.teacher_bimester_grades
      ADD CONSTRAINT teacher_bimester_grades_c5_check
      CHECK (c5_score IS NULL OR (c5_score >= 0 AND c5_score <= 10));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_bimester_grades_scope_idx
  ON public.teacher_bimester_grades(class_id, school_year, bimester);

DROP TRIGGER IF EXISTS update_teacher_classes_updated_at ON public.teacher_classes;
CREATE TRIGGER update_teacher_classes_updated_at
BEFORE UPDATE ON public.teacher_classes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_class_students_updated_at ON public.teacher_class_students;
CREATE TRIGGER update_teacher_class_students_updated_at
BEFORE UPDATE ON public.teacher_class_students
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_grade_lessons_updated_at ON public.teacher_grade_lessons;
CREATE TRIGGER update_teacher_grade_lessons_updated_at
BEFORE UPDATE ON public.teacher_grade_lessons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
