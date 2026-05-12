import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureCoordinationAgendaEventsSchema } from "@/lib/coordination"

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

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationAgendaEventsSchema()

  const { searchParams } = new URL(req.url)
  const from = String(searchParams.get("from") ?? "").trim()
  const to = String(searchParams.get("to") ?? "").trim()

  if (from && to && isValidDate(from) && isValidDate(to)) {
    const rows = await db`
      SELECT
        id,
        title,
        event_date,
        start_time,
        end_time,
        timezone,
        active,
        created_at,
        updated_at
      FROM coordination_agenda_events
      WHERE event_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY event_date ASC, start_time ASC, title ASC
    `

    return NextResponse.json(rows)
  }

  const rows = await db`
    SELECT
      id,
      title,
      event_date,
      start_time,
      end_time,
      timezone,
      active,
      created_at,
      updated_at
    FROM coordination_agenda_events
    ORDER BY event_date ASC, start_time ASC, title ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationAgendaEventsSchema()

  const body = await req.json()
  const title = String(body.title ?? "").trim()
  const event_date = String(body.event_date ?? "").trim()
  const start_time = String(body.start_time ?? "").trim()
  const end_time = String(body.end_time ?? "").trim()
  const timezone = String(body.timezone ?? "").trim()
  const active = body.active !== undefined ? !!body.active : true

  if (!title || !event_date || !timezone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!isValidDate(event_date)) {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 })
  }

  if (!isValidTime(start_time) || !isValidTime(end_time)) {
    return NextResponse.json({ error: "Horario invalido" }, { status: 400 })
  }

  if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return NextResponse.json({ error: "Horario inicial deve ser menor" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO coordination_agenda_events (
      title,
      event_date,
      start_time,
      end_time,
      timezone,
      active,
      created_by,
      updated_by
    )
    VALUES (
      ${title},
      ${event_date},
      ${start_time},
      ${end_time},
      ${timezone},
      ${active},
      ${admin.teacherId},
      ${admin.teacherId}
    )
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "admin.coordination_agenda_events.create",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_agenda_event", id: created?.id },
    metadata: { title, event_date, start_time, end_time, timezone, active },
  })

  return NextResponse.json(created)
}
