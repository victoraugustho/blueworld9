import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureGradebookSchema, isUuid } from "@/lib/gradebook"

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function weekdayFromIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const jsDay = date.getUTCDay() // 0 (domingo) ... 6
  return jsDay === 0 ? 7 : jsDay
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get("teacherId")

  if (teacherId) {
    const rows = await db`
      SELECT s.*, t.name AS teacher_name, t.country, t.locale
      FROM teacher_schedules s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE s.teacher_id = ${teacherId}
      ORDER BY s.event_date ASC NULLS LAST, s.weekday ASC, s.start_time ASC
    `
    return NextResponse.json(rows)
  }

  const rows = await db`
    SELECT s.*, t.name AS teacher_name, t.country, t.locale
    FROM teacher_schedules s
    JOIN teachers t ON t.id = s.teacher_id
    ORDER BY t.name ASC, s.event_date ASC NULLS LAST, s.weekday ASC, s.start_time ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const body = await req.json()
  const teacher_id = String(body.teacher_id ?? "").trim()
  const entry_type = String(body.entry_type ?? "class").trim().toLowerCase() === "event" ? "event" : "class"
  let is_recurring = body.is_recurring !== false
  let event_date = String(body.event_date ?? "").trim()
  const class_id_raw = String(body.class_id ?? "").trim()
  let class_id = class_id_raw && isUuid(class_id_raw) ? class_id_raw : null
  let class_label = String(body.class_label ?? "").trim()
  let weekday = Number(body.weekday)
  const start_time = String(body.start_time ?? "").trim()
  const end_time = String(body.end_time ?? "").trim()
  const timezone = String(body.timezone ?? "").trim()
  const active = body.active !== undefined ? !!body.active : true

  if (!teacher_id || !timezone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (entry_type === "class") {
    is_recurring = true
    event_date = ""
    if (!class_id) {
      return NextResponse.json({ error: "Turma obrigatoria para horario de aula" }, { status: 400 })
    }

    const [classRow] = await db`
      SELECT id, name
      FROM teacher_classes
      WHERE id = ${class_id}
        AND teacher_id = ${teacher_id}
      LIMIT 1
    `

    if (!classRow) {
      return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
    }

    class_label = String(classRow.name ?? "").trim()
  } else {
    class_id = null
    if (!class_label) {
      return NextResponse.json({ error: "Titulo do evento obrigatorio" }, { status: 400 })
    }
  }

  if (!is_recurring) {
    if (!event_date || !isValidDate(event_date)) {
      return NextResponse.json({ error: "Data do evento invalida" }, { status: 400 })
    }
    const parsedWeekday = weekdayFromIsoDate(event_date)
    if (!parsedWeekday) {
      return NextResponse.json({ error: "Data do evento invalida" }, { status: 400 })
    }
    weekday = parsedWeekday
  } else {
    event_date = ""
  }

  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return NextResponse.json({ error: "Dia da semana invalido" }, { status: 400 })
  }

  if (!isValidTime(start_time) || !isValidTime(end_time)) {
    return NextResponse.json({ error: "Horario invalido" }, { status: 400 })
  }

  if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return NextResponse.json({ error: "Horario inicial deve ser menor" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO teacher_schedules (
      teacher_id,
      class_id,
      class_label,
      entry_type,
      is_recurring,
      event_date,
      weekday,
      start_time,
      end_time,
      timezone,
      active
    )
    VALUES (
      ${teacher_id},
      ${class_id},
      ${class_label},
      ${entry_type},
      ${is_recurring},
      ${event_date || null},
      ${weekday},
      ${start_time},
      ${end_time},
      ${timezone},
      ${active}
    )
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "admin.teacher_schedules.create",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "teacher_schedule", id: created?.id },
    metadata: {
      teacher_id,
      class_id,
      class_label,
      entry_type,
      is_recurring,
      event_date: event_date || null,
      weekday,
      start_time,
      end_time,
      timezone,
      active,
    },
  })

  return NextResponse.json(created)
}
