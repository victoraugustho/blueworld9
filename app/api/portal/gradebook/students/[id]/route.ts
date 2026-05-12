import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  isUuid,
  normalizeEnrollmentCode,
  normalizeEnrollmentDate,
  normalizeStudentName,
} from "@/lib/gradebook"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function loadStudent(studentId: string) {
  const [row] = await db`
    SELECT
      s.*,
      c.teacher_id
    FROM teacher_class_students s
    JOIN teacher_classes c
      ON c.id = s.class_id
    WHERE s.id = ${studentId}
    LIMIT 1
  `
  return row
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode editar alunos." }, { status: 403 })
  }

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const studentId = String(resolved?.id ?? "").trim()
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: "Aluno invalido" }, { status: 400 })
  }

  const current = await loadStudent(studentId)
  if (!current) {
    return NextResponse.json({ error: "Aluno nao encontrado" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const fullName = body.full_name !== undefined ? normalizeStudentName(body.full_name) : current.full_name
  const enrollmentCode =
    body.enrollment_code !== undefined ? normalizeEnrollmentCode(body.enrollment_code) : current.enrollment_code
  const enrollmentAt =
    body.enrollment_at !== undefined
      ? normalizeEnrollmentDate(body.enrollment_at)
      : current.enrollment_at
  const active = body.active !== undefined ? body.active === true : current.active === true

  if (!fullName) {
    return NextResponse.json({ error: "Nome do aluno obrigatorio" }, { status: 400 })
  }

  try {
    const [updated] = await db`
      UPDATE teacher_class_students
      SET
        full_name = ${fullName},
        enrollment_code = ${enrollmentCode},
        enrollment_at = COALESCE(${enrollmentAt}, CURRENT_DATE),
        active = ${active}
      WHERE id = ${studentId}
      RETURNING *
    `
    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "23505") {
      return NextResponse.json({ error: "Codigo de matricula ja cadastrado nessa turma" }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode excluir alunos." }, { status: 403 })
  }

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const studentId = String(resolved?.id ?? "").trim()
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: "Aluno invalido" }, { status: 400 })
  }

  const current = await loadStudent(studentId)
  if (!current) {
    return NextResponse.json({ error: "Aluno nao encontrado" }, { status: 404 })
  }

  await db`
    DELETE FROM teacher_class_students
    WHERE id = ${studentId}
  `

  return NextResponse.json({ ok: true })
}
