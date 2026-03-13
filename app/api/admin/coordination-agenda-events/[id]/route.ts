import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

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

async function ensureCoordinationAgendaEventsTable() {
  await db`
    CREATE TABLE IF NOT EXISTS public.coordination_agenda_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      event_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db`
    CREATE INDEX IF NOT EXISTS coordination_agenda_events_date_idx
    ON public.coordination_agenda_events(event_date, start_time)
  `

  await db`
    CREATE INDEX IF NOT EXISTS coordination_agenda_events_active_idx
    ON public.coordination_agenda_events(active)
  `
}

async function findEvent(id: string) {
  const [row] = await db`
    SELECT id
    FROM coordination_agenda_events
    WHERE id = ${id}
    LIMIT 1
  `

  return row
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationAgendaEventsTable()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const exists = await findEvent(id)
  if (!exists) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

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

  const [updated] = await db`
    UPDATE coordination_agenda_events
    SET title = ${title},
        event_date = ${event_date},
        start_time = ${start_time},
        end_time = ${end_time},
        timezone = ${timezone},
        active = ${active},
        updated_by = ${admin.teacherId},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "admin.coordination_agenda_events.update",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_agenda_event", id },
    metadata: { title, event_date, start_time, end_time, timezone, active },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationAgendaEventsTable()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const exists = await findEvent(id)
  if (!exists) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  await db`
    DELETE FROM coordination_agenda_events
    WHERE id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.coordination_agenda_events.delete",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_agenda_event", id },
  })

  return NextResponse.json({ ok: true })
}
