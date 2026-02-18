import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

type RouteParams = { id: string }

export async function PUT(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const { id } = await params
  const normalizedId = String(id ?? "").trim()
  if (!normalizedId) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json()
  const lesson_date_raw = String(body.lesson_date ?? "").trim()
  const notes = typeof body.notes === "string" ? body.notes : ""
  const observations = typeof body.observations === "string" ? body.observations : ""
  const lesson_date = lesson_date_raw ? lesson_date_raw : null

  if (lesson_date && !isValidDate(lesson_date)) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 })
  }

  const [row] = await db`
    SELECT id
    FROM teacher_lesson_logs
    WHERE id = ${normalizedId}
      AND teacher_id = ${auth.teacherId}
    LIMIT 1
  `

  if (!row) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  const [updated] = lesson_date
    ? await db`
        UPDATE teacher_lesson_logs
        SET lesson_date = ${lesson_date},
            notes = ${notes},
            observations = ${observations}
        WHERE id = ${normalizedId}
        RETURNING *
      `
    : await db`
        UPDATE teacher_lesson_logs
        SET notes = ${notes},
            observations = ${observations}
        WHERE id = ${normalizedId}
        RETURNING *
      `

  await writeAuditLog({
    req,
    action: "teacher.lesson_logs.update",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "lesson_log", id: normalizedId },
    metadata: {
      lesson_date: lesson_date ?? null,
      notes_length: notes.length,
      observations_length: observations.length,
    },
  })

  return NextResponse.json(updated)
}
