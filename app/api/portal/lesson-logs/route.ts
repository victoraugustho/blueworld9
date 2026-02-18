import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { getDefaultTimezone } from "@/lib/timezones"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getTodayInTimeZone(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const classLabel = searchParams.get("class")?.trim() || null

  const rows = classLabel
    ? await db`
        SELECT *
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_label = ${classLabel}
        ORDER BY class_label ASC, lesson_number DESC, lesson_date DESC
      `
    : await db`
        SELECT *
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
        ORDER BY class_label ASC, lesson_number DESC, lesson_date DESC
      `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const schedule_id_raw = String(body.schedule_id ?? "").trim()
  const schedule_id = schedule_id_raw ? schedule_id_raw : null
  let class_label = String(body.class_label ?? "").trim()
  let timezone: string | null = null

  if (schedule_id) {
    const [schedule] = await db`
      SELECT id, class_label, timezone
      FROM teacher_schedules
      WHERE id = ${schedule_id}
        AND teacher_id = ${auth.teacherId}
      LIMIT 1
    `

    if (!schedule) {
      return NextResponse.json({ error: "Agendamento inválido" }, { status: 400 })
    }

    class_label = schedule.class_label
    timezone = schedule.timezone
  }

  if (!class_label) {
    return NextResponse.json({ error: "Turma obrigatória" }, { status: 400 })
  }

  const lesson_date_raw = String(body.lesson_date ?? "").trim()
  let lesson_date = ""
  if (lesson_date_raw) {
    if (!isValidDate(lesson_date_raw)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    }
    lesson_date = lesson_date_raw
  } else {
    const tz = timezone ?? getDefaultTimezone(auth.teacher.country)
    lesson_date = getTodayInTimeZone(tz)
  }

  const notes = typeof body.notes === "string" ? body.notes : ""
  const observations = typeof body.observations === "string" ? body.observations : ""

  let created: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    const [last] = await sql`
      SELECT lesson_number
      FROM teacher_lesson_logs
      WHERE teacher_id = ${auth.teacherId}
        AND class_label = ${class_label}
      ORDER BY lesson_number DESC
      LIMIT 1
      FOR UPDATE
    `

    const nextNumber = Number(last?.lesson_number ?? 0) + 1

    const [row] = await sql`
      INSERT INTO teacher_lesson_logs (teacher_id, schedule_id, class_label, lesson_number, lesson_date, notes, observations)
      VALUES (${auth.teacherId}, ${schedule_id}, ${class_label}, ${nextNumber}, ${lesson_date}, ${notes}, ${observations})
      RETURNING *
    `

    created = row
  })

  await writeAuditLog({
    req,
    action: "teacher.lesson_logs.create",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "lesson_log", id: created?.id },
    metadata: {
      class_label,
      lesson_number: created?.lesson_number,
      lesson_date,
      schedule_id,
      has_notes: notes.length > 0,
      has_observations: observations.length > 0,
    },
  })

  return NextResponse.json(created)
}
