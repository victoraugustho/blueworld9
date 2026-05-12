import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"
import { isValidStudentYear } from "@/lib/turma-years"

export type AttendanceStatus = "present" | "absent"

export function getScoreMaxByCountry(country: unknown) {
  return String(country ?? "").trim().toUpperCase() === "PY" ? 5 : 10
}

export function normalizeBimester(value: unknown) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return null
  return parsed
}

export function normalizeSchoolYear(value: unknown) {
  const fallback = new Date().getFullYear()
  if (value === undefined || value === null || value === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) return null
  return parsed
}

export function normalizeAttendance(value: unknown): AttendanceStatus {
  return value === "absent" ? "absent" : "present"
}

export function normalizeScore(value: unknown, max = 10) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (!Number.isFinite(max) || max <= 0) return null
  if (parsed < 0 || parsed > max) return null
  return Math.round(parsed * 100) / 100
}

export function normalizeClassName(value: unknown) {
  const name = String(value ?? "").trim()
  return name
}

export function normalizeStudentName(value: unknown) {
  const name = String(value ?? "").trim()
  return name
}

export function normalizeEnrollmentCode(value: unknown) {
  const code = String(value ?? "").trim()
  return code || null
}

export function normalizeEnrollmentDate(value: unknown) {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (match) return match[1]
  const isoWithTime = raw.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (isoWithTime) return isoWithTime[1]
  return null
}

export function normalizeStudentYear(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || !isValidStudentYear(parsed)) return null
  return parsed
}

export function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  )
}

export async function ensureGradebookSchema() {
  await ensureRuntimeSchema("schema:gradebook:v10", async () => {
    await db`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

    await db`
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
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_classes_teacher_year_name_idx
      ON public.teacher_classes(teacher_id, school_year, name)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_classes_teacher_year_idx
      ON public.teacher_classes(teacher_id, school_year)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_classes_student_year_idx
      ON public.teacher_classes(student_year)
    `

    await db`
      ALTER TABLE public.teacher_classes
      DROP COLUMN IF EXISTS category_id
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_class_students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        enrollment_code TEXT NULL,
        enrollment_at DATE NULL DEFAULT CURRENT_DATE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      ALTER TABLE public.teacher_class_students
      ADD COLUMN IF NOT EXISTS enrollment_at DATE NULL
    `

    await db`
      UPDATE public.teacher_class_students
      SET enrollment_at = created_at::date
      WHERE enrollment_at IS NULL
    `

    await db`
      ALTER TABLE public.teacher_class_students
      ALTER COLUMN enrollment_at SET DEFAULT CURRENT_DATE
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_class_students_class_idx
      ON public.teacher_class_students(class_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_class_students_active_idx
      ON public.teacher_class_students(active)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_class_students_class_active_enrollment_idx
      ON public.teacher_class_students(class_id, active, enrollment_at)
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_students_class_enrollment_idx
      ON public.teacher_class_students(class_id, enrollment_code)
      WHERE enrollment_code IS NOT NULL
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_grade_lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
        school_year SMALLINT NOT NULL,
        bimester SMALLINT NOT NULL CHECK (bimester BETWEEN 1 AND 4),
        lesson_number INTEGER NOT NULL CHECK (lesson_number > 0),
        lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
        has_grades BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      ALTER TABLE public.teacher_grade_lessons
      ADD COLUMN IF NOT EXISTS has_grades BOOLEAN NOT NULL DEFAULT TRUE
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS teacher_grade_lessons_unique_idx
      ON public.teacher_grade_lessons(class_id, school_year, bimester, lesson_number)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_grade_lessons_teacher_class_idx
      ON public.teacher_grade_lessons(teacher_id, class_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_grade_lessons_scope_idx
      ON public.teacher_grade_lessons(class_id, school_year, bimester, lesson_date DESC)
    `

    await db`
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
        PRIMARY KEY (lesson_id, student_id),
        CONSTRAINT teacher_grade_entries_attendance_check
          CHECK (attendance IN ('present', 'absent')),
        CONSTRAINT teacher_grade_entries_c1_check
          CHECK (c1 IS NULL OR (c1 >= 0 AND c1 <= 10)),
        CONSTRAINT teacher_grade_entries_c2_check
          CHECK (c2 IS NULL OR (c2 >= 0 AND c2 <= 10)),
        CONSTRAINT teacher_grade_entries_c3_check
          CHECK (c3 IS NULL OR (c3 >= 0 AND c3 <= 10)),
        CONSTRAINT teacher_grade_entries_c4_check
          CHECK (c4 IS NULL OR (c4 >= 0 AND c4 <= 10))
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_grade_entries_student_idx
      ON public.teacher_grade_entries(student_id)
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_bimester_grades (
        class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES public.teacher_class_students(id) ON DELETE CASCADE,
        school_year SMALLINT NOT NULL,
        bimester SMALLINT NOT NULL CHECK (bimester BETWEEN 1 AND 4),
        has_exam BOOLEAN NOT NULL DEFAULT FALSE,
        exam_score NUMERIC(4,2) NULL,
        c5_score NUMERIC(4,2) NULL,
        manual_final_score NUMERIC(4,2) NULL,
        notes TEXT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (class_id, student_id, school_year, bimester),
        CONSTRAINT teacher_bimester_grades_exam_check
          CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 10)),
        CONSTRAINT teacher_bimester_grades_c5_check
          CHECK (c5_score IS NULL OR (c5_score >= 0 AND c5_score <= 10))
      )
    `

    await db`
      ALTER TABLE public.teacher_bimester_grades
      ADD COLUMN IF NOT EXISTS manual_final_score NUMERIC(4,2) NULL
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'teacher_bimester_grades_manual_final_check'
        ) THEN
          ALTER TABLE public.teacher_bimester_grades
          ADD CONSTRAINT teacher_bimester_grades_manual_final_check
          CHECK (manual_final_score IS NULL OR (manual_final_score >= 0 AND manual_final_score <= 10));
        END IF;
      END
      $$;
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_bimester_grades_scope_idx
      ON public.teacher_bimester_grades(class_id, school_year, bimester)
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_gradebook_bimester_locks (
        class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
        school_year SMALLINT NOT NULL,
        bimester SMALLINT NOT NULL CHECK (bimester BETWEEN 1 AND 4),
        locked_by_teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (class_id, school_year, bimester)
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_gradebook_bimester_locks_teacher_idx
      ON public.teacher_gradebook_bimester_locks(locked_by_teacher_id, locked_at DESC)
    `

    await db`
      DROP INDEX IF EXISTS teacher_classes_unique_teacher_name_year_idx
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_classes_teacher_year_name_idx
      ON public.teacher_classes(teacher_id, school_year, name)
    `

    await db`
      ALTER TABLE public.teacher_schedules
      ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL
    `

    await db`
      ALTER TABLE public.teacher_schedules
      ADD COLUMN IF NOT EXISTS entry_type TEXT
    `

    await db`
      UPDATE public.teacher_schedules
      SET entry_type = 'class'
      WHERE entry_type IS NULL
    `

    await db`
      ALTER TABLE public.teacher_schedules
      ALTER COLUMN entry_type SET DEFAULT 'class',
      ALTER COLUMN entry_type SET NOT NULL
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'teacher_schedules_entry_type_check'
        ) THEN
          ALTER TABLE public.teacher_schedules
          ADD CONSTRAINT teacher_schedules_entry_type_check
          CHECK (entry_type IN ('class', 'event'));
        END IF;
      END
      $$;
    `

    await db`
      ALTER TABLE public.teacher_schedules
      ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN
    `

    await db`
      UPDATE public.teacher_schedules
      SET is_recurring = TRUE
      WHERE is_recurring IS NULL
    `

    await db`
      ALTER TABLE public.teacher_schedules
      ALTER COLUMN is_recurring SET DEFAULT TRUE,
      ALTER COLUMN is_recurring SET NOT NULL
    `

    await db`
      ALTER TABLE public.teacher_schedules
      ADD COLUMN IF NOT EXISTS event_date DATE NULL
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_schedules_teacher_class_id_idx
      ON public.teacher_schedules(teacher_id, class_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_schedules_teacher_entry_type_idx
      ON public.teacher_schedules(teacher_id, entry_type, is_recurring)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_schedules_event_date_idx
      ON public.teacher_schedules(event_date)
    `

    await db`
      ALTER TABLE public.teacher_classes
      ADD COLUMN IF NOT EXISTS source_schedule_id UUID NULL REFERENCES public.teacher_schedules(id) ON DELETE SET NULL
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS teacher_classes_source_schedule_unique_idx
      ON public.teacher_classes(source_schedule_id)
      WHERE source_schedule_id IS NOT NULL
    `

    await db`
      WITH one_schedule_per_class AS (
        SELECT
          s.class_id,
          MIN(s.id::text)::uuid AS schedule_id
        FROM public.teacher_schedules s
        WHERE s.entry_type = 'class'
          AND s.class_id IS NOT NULL
        GROUP BY s.class_id
        HAVING COUNT(*) = 1
      )
      UPDATE public.teacher_classes c
      SET source_schedule_id = o.schedule_id
      FROM one_schedule_per_class o
      WHERE c.id = o.class_id
        AND c.source_schedule_id IS NULL
    `

    await db`
      INSERT INTO public.teacher_classes (
        teacher_id,
        name,
        school_year,
        active,
        source_schedule_id
      )
      SELECT
        s.teacher_id,
        trim(s.class_label) AS class_name,
        EXTRACT(YEAR FROM NOW())::smallint,
        TRUE,
        s.id
      FROM public.teacher_schedules s
      WHERE s.entry_type = 'class'
        AND s.class_id IS NULL
        AND s.class_label IS NOT NULL
        AND trim(s.class_label) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM public.teacher_classes c
          WHERE c.source_schedule_id = s.id
        )
    `

    await db`
      UPDATE public.teacher_schedules s
      SET class_id = c.id
      FROM public.teacher_classes c
      WHERE s.entry_type = 'class'
        AND s.class_id IS NULL
        AND c.source_schedule_id = s.id
    `

    await db`
      UPDATE public.teacher_schedules s
      SET class_id = (
        SELECT c.id
        FROM public.teacher_classes c
        WHERE c.teacher_id = s.teacher_id
          AND lower(trim(c.name)) = lower(trim(s.class_label))
        ORDER BY c.created_at DESC
        LIMIT 1
      )
      WHERE s.class_id IS NULL
        AND s.entry_type = 'class'
        AND s.class_label IS NOT NULL
        AND trim(s.class_label) <> ''
        AND (
          SELECT COUNT(*)
          FROM public.teacher_classes c2
          WHERE c2.teacher_id = s.teacher_id
            AND lower(trim(c2.name)) = lower(trim(s.class_label))
        ) = 1
    `

    await db`
      WITH duplicated_schedule_classes AS (
        SELECT
          s.id AS schedule_id,
          s.class_id,
          s.teacher_id,
          trim(s.class_label) AS class_name
        FROM public.teacher_schedules s
        WHERE s.entry_type = 'class'
          AND s.class_id IS NOT NULL
          AND s.class_label IS NOT NULL
          AND trim(s.class_label) <> ''
          AND s.class_id IN (
            SELECT s2.class_id
            FROM public.teacher_schedules s2
            WHERE s2.entry_type = 'class'
              AND s2.class_id IS NOT NULL
            GROUP BY s2.class_id
            HAVING COUNT(*) > 1
          )
      ),
      split_eligibility AS (
        SELECT
          d.schedule_id,
          d.class_id,
          d.teacher_id,
          d.class_name
        FROM duplicated_schedule_classes d
        JOIN public.teacher_classes c
          ON c.id = d.class_id
        WHERE c.source_schedule_id IS DISTINCT FROM d.schedule_id
          AND (
            (
              SELECT COUNT(*)
              FROM public.teacher_class_students cs
              WHERE cs.class_id = d.class_id
                AND cs.active = TRUE
            ) = 0
            OR (
              SELECT COUNT(*)
              FROM public.teacher_lesson_logs l
              WHERE l.schedule_id = d.schedule_id
            ) = 0
          )
      )
      INSERT INTO public.teacher_classes (
        teacher_id,
        name,
        school_year,
        active,
        source_schedule_id
      )
      SELECT
        s.teacher_id,
        s.class_name,
        EXTRACT(YEAR FROM NOW())::smallint,
        TRUE,
        s.schedule_id
      FROM split_eligibility s
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.teacher_classes c
        WHERE c.source_schedule_id = s.schedule_id
      )
    `

    await db`
      UPDATE public.teacher_schedules s
      SET class_id = c.id
      FROM public.teacher_classes c
      WHERE s.entry_type = 'class'
        AND c.source_schedule_id = s.id
        AND s.class_id IS DISTINCT FROM c.id
        AND (
          (
            SELECT COUNT(*)
            FROM public.teacher_class_students cs
            WHERE cs.class_id = s.class_id
              AND cs.active = TRUE
          ) = 0
          OR (
            SELECT COUNT(*)
            FROM public.teacher_lesson_logs l
            WHERE l.schedule_id = s.id
          ) = 0
        )
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      ADD COLUMN IF NOT EXISTS school_year SMALLINT
    `

    await db`
      UPDATE public.teacher_lesson_logs
      SET school_year = EXTRACT(YEAR FROM lesson_date)::smallint
      WHERE school_year IS NULL
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      ALTER COLUMN school_year SET DEFAULT EXTRACT(YEAR FROM NOW())::smallint
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      ADD COLUMN IF NOT EXISTS bimester SMALLINT
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      ADD COLUMN IF NOT EXISTS has_grades BOOLEAN NOT NULL DEFAULT TRUE
    `

    await db`
      UPDATE public.teacher_lesson_logs
      SET bimester = CASE
        WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
        WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
        WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
        ELSE 4
      END
      WHERE bimester IS NULL
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      ALTER COLUMN bimester SET DEFAULT 1
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'teacher_lesson_logs_bimester_check'
        ) THEN
          ALTER TABLE public.teacher_lesson_logs
          ADD CONSTRAINT teacher_lesson_logs_bimester_check
          CHECK (bimester IS NULL OR (bimester BETWEEN 1 AND 4));
        END IF;
      END
      $$;
    `

    await db`
      UPDATE public.teacher_lesson_logs l
      SET class_id = s.class_id
      FROM public.teacher_schedules s
      WHERE l.schedule_id = s.id
        AND s.class_id IS NOT NULL
        AND (l.class_id IS NULL OR l.class_id IS DISTINCT FROM s.class_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_lesson_logs_class_id_idx
      ON public.teacher_lesson_logs(class_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_lesson_logs_scope_bimester_idx
      ON public.teacher_lesson_logs(teacher_id, class_id, school_year, bimester, lesson_number DESC)
    `

    await db`
      ALTER TABLE public.teacher_lesson_logs
      DROP CONSTRAINT IF EXISTS teacher_lesson_logs_teacher_id_class_label_lesson_number_key
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS teacher_lesson_logs_teacher_scope_lesson_unique_idx
      ON public.teacher_lesson_logs(
        teacher_id,
        COALESCE(class_id::text, schedule_id::text, class_label),
        lesson_number
      )
    `

    await db`
      ALTER TABLE public.teacher_reminders
      ADD COLUMN IF NOT EXISTS class_id UUID NULL REFERENCES public.teacher_classes(id) ON DELETE SET NULL
    `

    await db`
      ALTER TABLE public.teacher_reminders
      ADD COLUMN IF NOT EXISTS schedule_id UUID NULL REFERENCES public.teacher_schedules(id) ON DELETE SET NULL
    `

    await db`
      UPDATE public.teacher_reminders r
      SET class_id = s.class_id
      FROM public.teacher_schedules s
      WHERE r.schedule_id = s.id
        AND s.class_id IS NOT NULL
        AND (r.class_id IS NULL OR r.class_id IS DISTINCT FROM s.class_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_reminders_schedule_id_idx
      ON public.teacher_reminders(schedule_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_reminders_class_id_lesson_idx
      ON public.teacher_reminders(teacher_id, class_id, lesson_number)
    `

    await db`
      DROP TRIGGER IF EXISTS update_teacher_classes_updated_at
      ON public.teacher_classes
    `

    await db`
      CREATE TRIGGER update_teacher_classes_updated_at
      BEFORE UPDATE ON public.teacher_classes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `

    await db`
      DROP TRIGGER IF EXISTS update_teacher_class_students_updated_at
      ON public.teacher_class_students
    `

    await db`
      CREATE TRIGGER update_teacher_class_students_updated_at
      BEFORE UPDATE ON public.teacher_class_students
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `

    await db`
      DROP TRIGGER IF EXISTS update_teacher_grade_lessons_updated_at
      ON public.teacher_grade_lessons
    `

    await db`
      CREATE TRIGGER update_teacher_grade_lessons_updated_at
      BEFORE UPDATE ON public.teacher_grade_lessons
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `
  })
}

export async function getBimesterLock(
  classId: string,
  schoolYear: number,
  bimester: number,
) {
  const [lock] = await db`
    SELECT
      class_id,
      school_year,
      bimester,
      locked_by_teacher_id,
      locked_at
    FROM teacher_gradebook_bimester_locks
    WHERE class_id = ${classId}
      AND school_year = ${schoolYear}
      AND bimester = ${bimester}
    LIMIT 1
  `
  return lock ?? null
}
