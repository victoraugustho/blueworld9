import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureCoordinationAgendaSchema } from "@/lib/coordination"

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationAgendaSchema()

  const rows = await db`
    SELECT
      id,
      title,
      weekday,
      start_time,
      end_time,
      timezone,
      active,
      created_at,
      updated_at
    FROM coordination_agenda_items
    ORDER BY weekday ASC, start_time ASC, title ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationAgendaSchema()

  const body = await req.json()
  const title = String(body.title ?? "").trim()
  const weekday = Number(body.weekday)
  const start_time = String(body.start_time ?? "").trim()
  const end_time = String(body.end_time ?? "").trim()
  const timezone = String(body.timezone ?? "").trim()
  const active = body.active !== undefined ? !!body.active : true

  if (!title || !timezone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
    return NextResponse.json({ error: "Dia da semana invalido" }, { status: 400 })
  }

  if (!isValidTime(start_time) || !isValidTime(end_time)) {
    return NextResponse.json({ error: "Horario invalido" }, { status: 400 })
  }

  if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return NextResponse.json({ error: "Horario inicial deve ser menor" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO coordination_agenda_items (
      title,
      weekday,
      start_time,
      end_time,
      timezone,
      active,
      created_by,
      updated_by
    )
    VALUES (
      ${title},
      ${weekday},
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
    action: "admin.coordination_agenda.create",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_agenda_item", id: created?.id },
    metadata: { title, weekday, start_time, end_time, timezone, active },
  })

  return NextResponse.json(created)
}
