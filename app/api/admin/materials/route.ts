import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureTurmasSchema } from "@/lib/turmas"
import {
  evaluateMaterialAccessPolicy,
  normalizeMaterialAccessPolicy,
} from "@/lib/material-access"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const materials = await db`
    SELECT
      m.*,
      c.name AS category_name,
      COALESCE(m.access_scope, 'all') AS access_scope,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT mta.teacher_id), NULL),
        ARRAY[]::uuid[]
      ) AS teacher_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL),
        ARRAY[]::text[]
      ) AS teacher_names
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    LEFT JOIN material_teacher_access mta ON mta.material_id = m.id
    LEFT JOIN teachers t ON t.id = mta.teacher_id
    GROUP BY m.id, c.name
    ORDER BY m.created_at DESC
  `

  const teachers = await db`
    SELECT
      t.id, t.name, t.email, t.country, t.locale,
      COALESCE((
        SELECT ARRAY_AGG(tc.category_id ORDER BY tc.category_id)
        FROM teacher_categories tc
        WHERE tc.teacher_id = t.id
      ), ARRAY[]::int[]) AS category_ids,
      COALESCE((
        SELECT ARRAY_AGG(tys.student_year ORDER BY tys.student_year)
        FROM teacher_student_years tys
        WHERE tys.teacher_id = t.id
      ), ARRAY[]::smallint[]) AS student_years
    FROM teachers t
    WHERE t.approved = TRUE AND t.active = TRUE
  `

  const materialsWithEffectiveAccess = materials.map((material) => {
    let policy = null
    try {
      policy = normalizeMaterialAccessPolicy(material.access_policy)
    } catch {
      policy = null
    }

    const legacyTeacherIds = new Set((material.teacher_ids ?? []).map(String))
    const allowedTeachers = teachers.filter((teacher) => {
      if (policy) return evaluateMaterialAccessPolicy(policy, teacher as any).allowed
      if (teacher.locale !== material.language) return false
      if (material.category_id && !(teacher.category_ids ?? []).includes(material.category_id)) return false
      if (material.student_year && !(teacher.student_years ?? []).includes(material.student_year)) return false
      return material.access_scope !== "specific" || legacyTeacherIds.has(String(teacher.id))
    })

    return {
      ...material,
      effective_teacher_count: allowedTeachers.length,
      effective_teacher_names: allowedTeachers.map((teacher) => teacher.name),
    }
  })

  return NextResponse.json(materialsWithEffectiveAccess)
}
