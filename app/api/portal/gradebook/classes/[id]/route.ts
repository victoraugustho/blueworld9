import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { isAdminUser } from "@/lib/auth/authorization"
import {
  ensureGradebookSchema,
  isUuid,
  normalizeClassName,
  normalizeSchoolYear,
  normalizeStudentYear,
} from "@/lib/gradebook"
import { ensureTurmasSchema } from "@/lib/turmas"

type Ctx = { params: Promise<{ id: string }> }

async function loadClass(classId: string) {
  const [row] = await db`
    SELECT *
    FROM teacher_classes
    WHERE id = ${classId}
    LIMIT 1
  `
  return row
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = isAdminUser(auth.teacher)

  await ensureTurmasSchema()
  await ensureGradebookSchema()

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  const classRow = await loadClass(id)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }
  if (!isAdmin && classRow.teacher_id !== auth.teacherId) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const [row] = await db`
    SELECT
      c.*,
      COUNT(s.id)::int AS student_count,
      COUNT(CASE WHEN s.active THEN 1 END)::int AS active_student_count
    FROM teacher_classes c
    LEFT JOIN teacher_class_students s
      ON s.class_id = c.id
    WHERE c.id = ${id}
    GROUP BY c.id
    LIMIT 1
  `

  if (!row) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = isAdminUser(auth.teacher)
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode editar turmas." }, { status: 403 })
  }

  await ensureTurmasSchema()
  await ensureGradebookSchema()

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  const current = await loadClass(id)
  if (!current) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const name = body.name !== undefined ? normalizeClassName(body.name) : current.name
  const studentYear =
    body.student_year !== undefined ? normalizeStudentYear(body.student_year) : current.student_year
  const schoolYear =
    body.school_year !== undefined ? normalizeSchoolYear(body.school_year) : Number(current.school_year)
  const active = body.active !== undefined ? body.active === true : current.active === true
  const teacherId =
    body.teacher_id !== undefined ? String(body.teacher_id ?? "").trim() : String(current.teacher_id ?? "")

  if (!name) {
    return NextResponse.json({ error: "Nome da turma obrigatorio" }, { status: 400 })
  }

  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  if (
    body.student_year !== undefined &&
    body.student_year !== null &&
    body.student_year !== "" &&
    studentYear === null
  ) {
    return NextResponse.json({ error: "Ano da turma invalido" }, { status: 400 })
  }

  if (!isUuid(teacherId)) {
    return NextResponse.json({ error: "Professor invalido" }, { status: 400 })
  }

  const [teacherRow] = await db`
    SELECT id
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `

  if (!teacherRow) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  let updated: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    const [updatedRow] = await sql`
      UPDATE teacher_classes
      SET
        teacher_id = ${teacherId},
        name = ${name},
        student_year = ${studentYear},
        school_year = ${schoolYear},
        active = ${active}
      WHERE id = ${id}
      RETURNING *
    `

    updated = updatedRow

    await sql`
      UPDATE teacher_schedules
      SET class_label = ${name}
      WHERE class_id = ${id}
        AND entry_type = 'class'
        AND class_label IS DISTINCT FROM ${name}
    `

    await sql`
      UPDATE teacher_lesson_logs
      SET class_label = ${name}
      WHERE class_id = ${id}
        AND class_label IS DISTINCT FROM ${name}
    `

    await sql`
      UPDATE teacher_reminders
      SET class_label = ${name}
      WHERE class_id = ${id}
        AND class_label IS DISTINCT FROM ${name}
    `
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = isAdminUser(auth.teacher)
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode excluir turmas." }, { status: 403 })
  }

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  const [classRow] = await db`
    SELECT id
    FROM teacher_classes
    WHERE id = ${id}
    LIMIT 1
  `

  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  await db`
    DELETE FROM teacher_schedules
    WHERE class_id = ${id}
  `

  const [deleted] = await db`
    DELETE FROM teacher_classes
    WHERE id = ${id}
    RETURNING id
  `

  if (!deleted) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
