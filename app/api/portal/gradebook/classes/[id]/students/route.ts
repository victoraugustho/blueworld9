import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  isUuid,
  normalizeEnrollmentCode,
  normalizeStudentName,
} from "@/lib/gradebook"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function loadClass(classId: string) {
  const [classRow] = await db`
    SELECT id, teacher_id
    FROM teacher_classes
    WHERE id = ${classId}
    LIMIT 1
  `
  return classRow
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const classId = String(resolved?.id ?? "").trim()
  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  const classRow = await loadClass(classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }
  if (!isAdmin && classRow.teacher_id !== auth.teacherId) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const rows = await db`
    SELECT *
    FROM teacher_class_students
    WHERE class_id = ${classId}
    ORDER BY LOWER(TRIM(full_name)) ASC, full_name ASC, created_at ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode gerenciar alunos da turma." }, { status: 403 })
  }

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const classId = String(resolved?.id ?? "").trim()
  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  const classRow = await loadClass(classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  const bulk = Array.isArray(body.students) ? body.students : null
  if (bulk && bulk.length > 0) {
    const sortedBulk = [...bulk].sort((a, b) =>
      String(a?.full_name ?? a?.name ?? "")
        .trim()
        .localeCompare(String(b?.full_name ?? b?.name ?? "").trim(), "pt-BR", {
          sensitivity: "base",
          ignorePunctuation: true,
        }),
    )

    const inserted: any[] = []
    await db.begin(async (tx) => {
      const sql = (tx as any).sql ?? tx
      for (const item of sortedBulk) {
        const fullName = normalizeStudentName(item?.full_name ?? item?.name)
        if (!fullName) continue
        const enrollmentCode = normalizeEnrollmentCode(item?.enrollment_code)
        const [row] = await sql`
          INSERT INTO teacher_class_students (class_id, full_name, enrollment_code, active)
          VALUES (${classId}, ${fullName}, ${enrollmentCode}, TRUE)
          RETURNING *
        `
        inserted.push(row)
      }
    })

    inserted.sort((a, b) =>
      String(a?.full_name ?? "").localeCompare(String(b?.full_name ?? ""), "pt-BR", {
        sensitivity: "base",
        ignorePunctuation: true,
      }),
    )

    return NextResponse.json(inserted)
  }

  const fullName = normalizeStudentName(body.full_name ?? body.name)
  const enrollmentCode = normalizeEnrollmentCode(body.enrollment_code)
  const active = body.active === undefined ? true : body.active === true

  if (!fullName) {
    return NextResponse.json({ error: "Nome do aluno obrigatorio" }, { status: 400 })
  }

  try {
    const [created] = await db`
      INSERT INTO teacher_class_students (class_id, full_name, enrollment_code, active)
      VALUES (${classId}, ${fullName}, ${enrollmentCode}, ${active})
      RETURNING *
    `
    return NextResponse.json(created)
  } catch (error: any) {
    if (String(error?.code) === "23505") {
      return NextResponse.json({ error: "Codigo de matricula ja cadastrado nessa turma" }, { status: 409 })
    }
    throw error
  }
}
