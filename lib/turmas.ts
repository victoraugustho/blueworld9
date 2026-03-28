import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"
import { isValidStudentYear } from "@/lib/turma-years"
export { TURMA_YEAR_OPTIONS, getTurmaYearLabel, isValidStudentYear } from "@/lib/turma-years"

export async function ensureTurmasSchema() {
  await ensureRuntimeSchema("schema:turmas:v2", async () => {
    await db`
      CREATE TABLE IF NOT EXISTS public.categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_categories (
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (teacher_id, category_id)
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_categories_teacher_idx
      ON public.teacher_categories(teacher_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_categories_category_idx
      ON public.teacher_categories(category_id)
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_student_years (
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        student_year SMALLINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (teacher_id, student_year)
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_student_years_teacher_idx
      ON public.teacher_student_years(teacher_id)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_student_years_year_idx
      ON public.teacher_student_years(student_year)
    `

    await db`
      ALTER TABLE public.materials
      ADD COLUMN IF NOT EXISTS access_scope TEXT
    `

    await db`
      UPDATE public.materials
      SET access_scope = 'all'
      WHERE access_scope IS NULL
    `

    await db`
      ALTER TABLE public.materials
      ALTER COLUMN access_scope SET DEFAULT 'all'
    `

    await db`
      ALTER TABLE public.materials
      ALTER COLUMN access_scope SET NOT NULL
    `

    await db`
      ALTER TABLE public.materials
      ADD COLUMN IF NOT EXISTS video_notes TEXT
    `

    await db`
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
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.material_teacher_access (
        material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (material_id, teacher_id)
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS material_teacher_access_teacher_idx
      ON public.material_teacher_access(teacher_id)
    `
  })
}

export function normalizeCategoryIds(value: unknown): number[] {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
  return Array.from(new Set(normalized))
}

export function normalizeTeacherIds(value: unknown): string[] {
  const source = Array.isArray(value) ? value : []
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const normalized = source
    .map((item) => String(item ?? "").trim())
    .filter((item) => uuidRegex.test(item))
  return Array.from(new Set(normalized))
}

export function normalizeStudentYears(value: unknown): number[] {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => Number(item))
    .filter((item) => isValidStudentYear(item))
  return Array.from(new Set(normalized))
}
