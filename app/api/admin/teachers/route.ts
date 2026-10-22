import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureTurmasSchema } from "@/lib/turmas"
import { isConfiguredSuperAdminId, isSuperAdmin } from "@/lib/auth/super-admin"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const approved = await db`
    SELECT
      id, name, email, phone,
      avatar_url,
      country, locale, document_type, document_number,
      approved, active, role, is_admin,
      COALESCE(NULLIF(to_jsonb(teachers)->>'can_download', '')::boolean, TRUE) AS can_download,
      COALESCE(
        to_jsonb(teachers)->'portal_permissions',
        '{"aulas":true,"agenda_notas":true,"materiais":true,"projetos":true,"ia":true}'::jsonb
      ) AS portal_permissions,
      COALESCE(
        to_jsonb(teachers)->'content_permissions',
        '{"aulas":{"mode":"inherit","category_ids":[],"item_ids":[]},"materiais":{"mode":"inherit","category_ids":[],"item_ids":[]},"projetos":{"mode":"inherit","category_ids":[],"item_ids":[]}}'::jsonb
      ) AS content_permissions,
      created_at, updated_at,
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
      approved, active, role, is_admin,
      COALESCE(NULLIF(to_jsonb(teachers)->>'can_download', '')::boolean, TRUE) AS can_download,
      COALESCE(
        to_jsonb(teachers)->'portal_permissions',
        '{"aulas":true,"agenda_notas":true,"materiais":true,"projetos":true,"ia":true}'::jsonb
      ) AS portal_permissions,
      COALESCE(
        to_jsonb(teachers)->'content_permissions',
        '{"aulas":{"mode":"inherit","category_ids":[],"item_ids":[]},"materiais":{"mode":"inherit","category_ids":[],"item_ids":[]},"projetos":{"mode":"inherit","category_ids":[],"item_ids":[]}}'::jsonb
      ) AS content_permissions,
      created_at, updated_at,
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
      approved, active, role, is_admin,
      COALESCE(NULLIF(to_jsonb(teachers)->>'can_download', '')::boolean, TRUE) AS can_download,
      COALESCE(
        to_jsonb(teachers)->'portal_permissions',
        '{"aulas":true,"agenda_notas":true,"materiais":true,"projetos":true,"ia":true}'::jsonb
      ) AS portal_permissions,
      COALESCE(
        to_jsonb(teachers)->'content_permissions',
        '{"aulas":{"mode":"inherit","category_ids":[],"item_ids":[]},"materiais":{"mode":"inherit","category_ids":[],"item_ids":[]},"projetos":{"mode":"inherit","category_ids":[],"item_ids":[]}}'::jsonb
      ) AS content_permissions,
      created_at, updated_at,
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

  const describe = (teacher: (typeof approved)[number]) => ({
    ...teacher,
    is_super_admin: isSuperAdmin(teacher),
    role_management_protected: isConfiguredSuperAdminId(teacher.id),
  })
  return NextResponse.json({
    approved:approved.map(describe),pending:pending.map(describe),disabled:disabled.map(describe),
    can_manage_roles:isSuperAdmin({...admin.teacher,id:admin.teacherId}),
  }, {headers:{'Cache-Control':'private, no-store'}})
}
