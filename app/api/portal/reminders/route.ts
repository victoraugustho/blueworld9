import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const rows = await db`
    SELECT *
    FROM teacher_reminders
    WHERE teacher_id = ${auth.teacherId}
    ORDER BY done ASC, created_at DESC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const content = String(body.content ?? "").trim()
  const classLabel = String(body.class_label ?? "").trim()
  const lessonNumberRaw = body.lesson_number
  const lessonNumber =
    lessonNumberRaw === "" || lessonNumberRaw === null || lessonNumberRaw === undefined
      ? null
      : Number(lessonNumberRaw)

  if (!content) {
    return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 })
  }

  if (classLabel && lessonNumber === null) {
    return NextResponse.json({ error: "Número da aula obrigatório" }, { status: 400 })
  }

  if (lessonNumber !== null) {
    if (!classLabel) {
      return NextResponse.json({ error: "Turma obrigatória" }, { status: 400 })
    }
    if (!Number.isInteger(lessonNumber) || lessonNumber <= 0) {
      return NextResponse.json({ error: "Número da aula inválido" }, { status: 400 })
    }
  }

  const class_label = classLabel ? classLabel : null

  if (class_label && lessonNumber !== null) {
    const [row] = await db`
      SELECT MAX(lesson_number) AS last_lesson
      FROM teacher_lesson_logs
      WHERE teacher_id = ${auth.teacherId}
        AND class_label = ${class_label}
    `
    const lastLesson = Number(row?.last_lesson ?? 0)
    const nextLesson = lastLesson + 1
    if (lessonNumber < nextLesson) {
      return NextResponse.json({ error: "A aula informada já passou" }, { status: 400 })
    }
  }

  const [row] = await db`
    INSERT INTO teacher_reminders (teacher_id, content, class_label, lesson_number)
    VALUES (${auth.teacherId}, ${content}, ${class_label}, ${lessonNumber})
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "teacher.reminders.create",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "teacher_reminder", id: row?.id },
    metadata: {
      content_length: content.length,
      class_label,
      lesson_number: lessonNumber,
    },
  })

  return NextResponse.json(row)
}
