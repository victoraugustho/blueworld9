import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureTurmasSchema } from "@/lib/turmas"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const approved = await db`
    SELECT
      id, name, email, phone,
      avatar_url,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at,
      COALESCE(
        (SELECT ARRAY_AGG(tc.category_id ORDER BY tc.category_id) FROM teacher_categories tc WHERE tc.teacher_id = teachers.id),
        ARRAY[]::int[]
      ) AS category_ids,
      COALESCE(
        (SELECT COUNT(*)::int FROM teacher_categories tc WHERE tc.teacher_id = teachers.id),
        0
      ) AS turma_count,
      COALESCE(
        (SELECT ARRAY_AGG(tys.student_year ORDER BY tys.student_year) FROM teacher_student_years tys WHERE tys.teacher_id = teachers.id),
        ARRAY[]::smallint[]
      ) AS student_years,
      COALESCE(
        (SELECT COUNT(*)::int FROM teacher_student_years tys WHERE tys.teacher_id = teachers.id),
        0
      ) AS turma_year_count
    FROM teachers
    WHERE approved = TRUE AND active = TRUE
    ORDER BY created_at DESC
  `

  const pending = await db`
    SELECT
      id, name, email, phone,
      avatar_url,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at,
      COALESCE(
        (SELECT ARRAY_AGG(tc.category_id ORDER BY tc.category_id) FROM teacher_categories tc WHERE tc.teacher_id = teachers.id),
        ARRAY[]::int[]
      ) AS category_ids,
      COALESCE(
        (SELECT COUNT(*)::int FROM teacher_categories tc WHERE tc.teacher_id = teachers.id),
        0
      ) AS turma_count,
      COALESCE(
        (SELECT ARRAY_AGG(tys.student_year ORDER BY tys.student_year) FROM teacher_student_years tys WHERE tys.teacher_id = teachers.id),
        ARRAY[]::smallint[]
      ) AS student_years,
      COALESCE(
        (SELECT COUNT(*)::int FROM teacher_student_years tys WHERE tys.teacher_id = teachers.id),
        0
      ) AS turma_year_count
    FROM teachers
    WHERE approved = FALSE AND active = TRUE
    ORDER BY created_at DESC
  `

  const disabled = await db`
    SELECT
      id, name, email, phone,
      avatar_url,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at,
      COALESCE(
        (SELECT ARRAY_AGG(tc.category_id ORDER BY tc.category_id) FROM teacher_categories tc WHERE tc.teacher_id = teachers.id),
        ARRAY[]::int[]
      ) AS category_ids,
      COALESCE(
        (SELECT COUNT(*)::int FROM teacher_categories tc WHERE tc.teacher_id = teachers.id),
        0
      ) AS turma_count,
      COALESCE(
        (SELECT ARRAY_AGG(tys.student_year ORDER BY tys.student_year) FROM teacher_student_years tys WHERE tys.teacher_id = teachers.id),
        ARRAY[]::smallint[]
      ) AS student_years,
      COALESCE(
        (SELECT COUNT(*)::int FROM teacher_student_years tys WHERE tys.teacher_id = teachers.id),
        0
      ) AS turma_year_count
    FROM teachers
    WHERE active = FALSE
    ORDER BY created_at DESC
  `

  return NextResponse.json({ approved, pending, disabled })
}
