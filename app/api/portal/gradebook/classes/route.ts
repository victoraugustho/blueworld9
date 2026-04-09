import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  isUuid,
  normalizeClassName,
  normalizeSchoolYear,
  normalizeStudentYear,
} from "@/lib/gradebook"
import { ensureTurmasSchema } from "@/lib/turmas"

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  await ensureTurmasSchema()
  await ensureGradebookSchema()

  const search = new URL(req.url).searchParams
  const schoolYear = normalizeSchoolYear(search.get("schoolYear"))
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }
  const teacherIdParam = String(search.get("teacherId") ?? "").trim()
  if (isAdmin && teacherIdParam && !isUuid(teacherIdParam)) {
    return NextResponse.json({ error: "Professor invalido" }, { status: 400 })
  }
  const targetTeacherId =
    isAdmin && isUuid(teacherIdParam)
      ? teacherIdParam
      : auth.teacherId

  const rows = await db`
    SELECT
      c.*,
      COUNT(DISTINCT s.id)::int AS student_count
    FROM teacher_classes c
    LEFT JOIN teacher_class_students s
      ON s.class_id = c.id
     AND s.active = TRUE
    WHERE c.teacher_id = ${targetTeacherId}
      AND c.school_year = ${schoolYear}
    GROUP BY c.id
    ORDER BY c.active DESC, c.name ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode criar turmas." }, { status: 403 })
  }

  await ensureTurmasSchema()
  await ensureGradebookSchema()

  const body = await req.json().catch(() => ({}))
  const teacherId = String(body.teacher_id ?? "").trim()
  const name = normalizeClassName(body.name)
  const studentYear = normalizeStudentYear(body.student_year)
  const schoolYear = normalizeSchoolYear(body.school_year)
  const active = body.active === undefined ? true : body.active === true

  if (!isUuid(teacherId)) {
    return NextResponse.json({ error: "Professor invalido" }, { status: 400 })
  }

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

  const [teacherRow] = await db`
    SELECT id
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `

  if (!teacherRow) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  const [created] = await db`
    INSERT INTO teacher_classes (
      teacher_id,
      name,
      student_year,
      school_year,
      active
    )
    VALUES (
      ${teacherId},
      ${name},
      ${studentYear},
      ${schoolYear},
      ${active}
    )
    RETURNING *
  `

  return NextResponse.json(created)
}
