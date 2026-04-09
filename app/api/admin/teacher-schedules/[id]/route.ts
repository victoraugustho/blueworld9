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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const body = await req.json()
  const class_id_raw = String(body.class_id ?? "").trim()
  const class_id = class_id_raw && isUuid(class_id_raw) ? class_id_raw : null
  let class_label = String(body.class_label ?? "").trim()
  const weekday = Number(body.weekday)
  const start_time = String(body.start_time ?? "").trim()
  const end_time = String(body.end_time ?? "").trim()
  const timezone = String(body.timezone ?? "").trim()
  const active = body.active !== undefined ? !!body.active : true

  const [current] = await db`
    SELECT id, teacher_id
    FROM teacher_schedules
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  if (!timezone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (class_id) {
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

    if (!class_label) {
      class_label = String(classRow.name ?? "").trim()
    }
  }

  if (!class_label) {
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

  const [updated] = await db`
    UPDATE teacher_schedules
    SET class_id = ${class_id},
        class_label = ${class_label},
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
    metadata: { class_id, class_label, weekday, start_time, end_time, timezone, active },
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
