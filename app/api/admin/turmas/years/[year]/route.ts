import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema, getTurmaYearLabel, isValidStudentYear, normalizeTeacherIds } from "@/lib/turmas"

type Ctx = { params: Promise<{ year: string }> | { year: string } }

function parseStudentYear(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || !isValidStudentYear(parsed)) return null
  return parsed
}

async function loadYearData(studentYear: number) {
  const [summary] = await db`
    SELECT
      ${studentYear}::int AS student_year,
      (SELECT COUNT(*) FROM teacher_student_years WHERE student_year = ${studentYear})::int AS teacher_count,
      (SELECT COUNT(*) FROM materials WHERE student_year = ${studentYear})::int AS material_count,
      COALESCE(
        (SELECT ARRAY_AGG(teacher_id ORDER BY teacher_id)
         FROM teacher_student_years
         WHERE student_year = ${studentYear}),
        ARRAY[]::uuid[]
      ) AS teacher_ids,
      COALESCE(
        (SELECT ARRAY_AGG(t.name ORDER BY t.name)
         FROM teacher_student_years tys
         JOIN teachers t ON t.id = tys.teacher_id
         WHERE tys.student_year = ${studentYear}),
        ARRAY[]::text[]
      ) AS teacher_names
  `

  return {
    student_year: studentYear,
    label: getTurmaYearLabel(studentYear),
    teacher_count: Number(summary?.teacher_count ?? 0),
    material_count: Number(summary?.material_count ?? 0),
    teacher_ids: Array.isArray(summary?.teacher_ids) ? summary.teacher_ids : [],
    teacher_names: Array.isArray(summary?.teacher_names) ? summary.teacher_names : [],
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await ctx.params
  const studentYear = parseStudentYear(String(resolved?.year ?? ""))
  if (!studentYear) {
    return NextResponse.json({ error: "Turma (ano) invalida" }, { status: 400 })
  }

  return NextResponse.json(await loadYearData(studentYear))
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await ctx.params
  const studentYear = parseStudentYear(String(resolved?.year ?? ""))
  if (!studentYear) {
    return NextResponse.json({ error: "Turma (ano) invalida" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const teacherIds = normalizeTeacherIds(body.teacher_ids)

  if (teacherIds.length > 0) {
    const validTeachers = await db`
      SELECT id
      FROM teachers
      WHERE id = ANY(${teacherIds}::uuid[])
    `

    if (validTeachers.length !== teacherIds.length) {
      return NextResponse.json({ error: "Existe professor invalido na selecao" }, { status: 400 })
    }
  }

  await db`
    DELETE FROM teacher_student_years
    WHERE student_year = ${studentYear}
  `

  if (teacherIds.length > 0) {
    await db`
      INSERT INTO teacher_student_years (teacher_id, student_year)
      SELECT UNNEST(${teacherIds}::uuid[]), ${studentYear}
      ON CONFLICT (teacher_id, student_year) DO NOTHING
    `
  }

  const data = await loadYearData(studentYear)

  await writeAuditLog({
    req,
    action: "admin.turmas.years.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "turma_ano", id: String(studentYear) },
    metadata: {
      student_year: studentYear,
      label: data.label,
      teacher_count: data.teacher_count,
    },
  })

  return NextResponse.json({ success: true, turma_year: data })
}
