import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureGradebookSchema, isUuid } from "@/lib/gradebook"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

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

  await ensureGradebookSchema()

  const body = await req.json()
  const content = String(body.content ?? "").trim()
  const classLabelRaw = String(body.class_label ?? "").trim()
  const classIdRaw = String(body.class_id ?? "").trim()
  const scheduleIdRaw = String(body.schedule_id ?? "").trim()

  const lessonNumberRaw = body.lesson_number
  const lessonNumber =
    lessonNumberRaw === "" || lessonNumberRaw === null || lessonNumberRaw === undefined
      ? null
      : Number(lessonNumberRaw)

  if (!content) {
    return NextResponse.json({ error: "Texto obrigatorio" }, { status: 400 })
  }

  let class_id = classIdRaw && isUuid(classIdRaw) ? classIdRaw : null
  let schedule_id = scheduleIdRaw && isUuid(scheduleIdRaw) ? scheduleIdRaw : null
  let class_label = classLabelRaw || null

  if (schedule_id) {
    const [schedule] = await db`
      SELECT id, class_id, class_label
      FROM teacher_schedules
      WHERE id = ${schedule_id}
        AND teacher_id = ${auth.teacherId}
      LIMIT 1
    `

    if (!schedule) {
      return NextResponse.json({ error: "Agendamento invalido" }, { status: 400 })
    }

    class_label = String(schedule.class_label ?? "").trim() || class_label
    if (schedule.class_id) {
      class_id = String(schedule.class_id)
    }
  }

  if (class_id) {
    const [classRow] = await db`
      SELECT id, name
      FROM teacher_classes
      WHERE id = ${class_id}
        AND teacher_id = ${auth.teacherId}
      LIMIT 1
    `

    if (!classRow) {
      return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
    }

    if (!class_label) {
      class_label = String(classRow.name ?? "").trim() || null
    }
  }

  if ((class_id || schedule_id || class_label) && lessonNumber === null) {
    return NextResponse.json({ error: "Numero da aula obrigatorio" }, { status: 400 })
  }

  if (lessonNumber !== null) {
    if (!Number.isInteger(lessonNumber) || lessonNumber <= 0) {
      return NextResponse.json({ error: "Numero da aula invalido" }, { status: 400 })
    }

    if (!class_id && !schedule_id && !class_label) {
      return NextResponse.json({ error: "Turma obrigatoria" }, { status: 400 })
    }
  }

  if (lessonNumber !== null) {
    let row: any | undefined

    if (class_id) {
      ;[row] = await db`
        SELECT MAX(lesson_number) AS last_lesson
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_id = ${class_id}
      `
    } else if (schedule_id) {
      ;[row] = await db`
        SELECT MAX(lesson_number) AS last_lesson
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND schedule_id = ${schedule_id}
          AND class_id IS NULL
      `
    } else {
      ;[row] = await db`
        SELECT MAX(lesson_number) AS last_lesson
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_label = ${class_label}
          AND class_id IS NULL
          AND schedule_id IS NULL
      `
    }

    const lastLesson = Number(row?.last_lesson ?? 0)
    const nextLesson = lastLesson + 1
    if (lessonNumber < nextLesson) {
      return NextResponse.json({ error: "A aula informada ja passou" }, { status: 400 })
    }
  }

  const [row] = await db`
    INSERT INTO teacher_reminders (
      teacher_id,
      content,
      class_label,
      class_id,
      schedule_id,
      lesson_number
    )
    VALUES (
      ${auth.teacherId},
      ${content},
      ${class_label},
      ${class_id},
      ${schedule_id},
      ${lessonNumber}
    )
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
      class_id,
      schedule_id,
      lesson_number: lessonNumber,
    },
  })

  return NextResponse.json(row)
}
