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

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get("teacherId")

  if (teacherId) {
    const rows = await db`
      SELECT s.*, t.name AS teacher_name, t.country, t.locale
      FROM teacher_schedules s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE s.teacher_id = ${teacherId}
      ORDER BY s.weekday ASC, s.start_time ASC
    `
    return NextResponse.json(rows)
  }

  const rows = await db`
    SELECT s.*, t.name AS teacher_name, t.country, t.locale
    FROM teacher_schedules s
    JOIN teachers t ON t.id = s.teacher_id
    ORDER BY t.name ASC, s.weekday ASC, s.start_time ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await req.json()
  const teacher_id = String(body.teacher_id ?? "").trim()
  const class_label = String(body.class_label ?? "").trim()
  const weekday = Number(body.weekday)
  const start_time = String(body.start_time ?? "").trim()
  const end_time = String(body.end_time ?? "").trim()
  const timezone = String(body.timezone ?? "").trim()
  const active = body.active !== undefined ? !!body.active : true

  if (!teacher_id || !class_label || !timezone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
    return NextResponse.json({ error: "Dia da semana inválido" }, { status: 400 })
  }

  if (!isValidTime(start_time) || !isValidTime(end_time)) {
    return NextResponse.json({ error: "Horário inválido" }, { status: 400 })
  }

  if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return NextResponse.json({ error: "Horário inicial deve ser menor" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO teacher_schedules (teacher_id, class_label, weekday, start_time, end_time, timezone, active)
    VALUES (${teacher_id}, ${class_label}, ${weekday}, ${start_time}, ${end_time}, ${timezone}, ${active})
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
    metadata: { teacher_id, class_label, weekday, start_time, end_time, timezone, active },
  })

  return NextResponse.json(created)
}
