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
  const jsDay = date.getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const [current] = await db`
    SELECT id, teacher_id, class_id, class_label, entry_type, is_recurring, event_date, weekday, start_time, end_time, timezone, active
    FROM teacher_schedules
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  const body = await req.json()

  const entry_type =
    String(body.entry_type ?? current.entry_type ?? "class").trim().toLowerCase() === "event"
      ? "event"
      : "class"
  let is_recurring = body.is_recurring !== undefined ? body.is_recurring === true : current.is_recurring !== false
  let event_date = String(body.event_date ?? current.event_date ?? "").trim()

  const class_id_raw =
    body.class_id !== undefined ? String(body.class_id ?? "").trim() : String(current.class_id ?? "").trim()
  let class_id = class_id_raw && isUuid(class_id_raw) ? class_id_raw : null

  let class_label =
    body.class_label !== undefined ? String(body.class_label ?? "").trim() : String(current.class_label ?? "").trim()

  let weekday = Number(body.weekday ?? current.weekday)
  const start_time = String(body.start_time ?? current.start_time ?? "").trim()
  const end_time = String(body.end_time ?? current.end_time ?? "").trim()
  const timezone = String(body.timezone ?? current.timezone ?? "").trim()
  const active = body.active !== undefined ? body.active === true : current.active === true

  if (!timezone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  const isConvertingClassToEvent =
    String(current.entry_type ?? "class") === "class" &&
    entry_type === "event" &&
    current.class_id

  if (isConvertingClassToEvent) {
    const [studentsCountRow] = await db`
      SELECT COUNT(*)::int AS students_count
      FROM teacher_class_students
      WHERE class_id = ${current.class_id}
    `
    const studentsCount = Number(studentsCountRow?.students_count ?? 0)
    if (studentsCount > 0) {
      return NextResponse.json(
        { error: "Nao e possivel transformar turma em evento com alunos cadastrados." },
        { status: 400 },
      )
    }
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
        AND teacher_id = ${current.teacher_id}
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

  const [updated] = await db`
    UPDATE teacher_schedules
    SET
      class_id = ${class_id},
      class_label = ${class_label},
      entry_type = ${entry_type},
      is_recurring = ${is_recurring},
      event_date = ${event_date || null},
      weekday = ${weekday},
      start_time = ${start_time},
      end_time = ${end_time},
      timezone = ${timezone},
      active = ${active}
    WHERE id = ${id}
    RETURNING *
  `

  if (!updated) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.teacher_schedules.update",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "teacher_schedule", id },
    metadata: {
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

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const [deleted] = await db`
    DELETE FROM teacher_schedules
    WHERE id = ${id}
    RETURNING id
  `

  if (!deleted) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.teacher_schedules.delete",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "teacher_schedule", id },
  })

  return NextResponse.json({ ok: true })
}
