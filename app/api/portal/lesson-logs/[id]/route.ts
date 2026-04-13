import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function inferBimesterFromDate(value: string) {
  if (!isValidDate(value)) return null
  const month = Number(value.slice(5, 7))
  if (!Number.isFinite(month)) return null
  if (month >= 1 && month <= 3) return 1
  if (month >= 4 && month <= 6) return 2
  if (month >= 7 && month <= 9) return 3
  return 4
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
  const bimesterRaw = Number(body.bimester)
  const bimester =
    Number.isInteger(bimesterRaw) && bimesterRaw >= 1 && bimesterRaw <= 4 ? bimesterRaw : null
  const lesson_date = lesson_date_raw ? lesson_date_raw : null
  const inferredBimester = lesson_date ? inferBimesterFromDate(lesson_date) : null
  const bimesterToPersist = bimester ?? inferredBimester
  const schoolYearToPersist = lesson_date ? Number(lesson_date.slice(0, 4)) : null

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

  const [updated] = await db`
    UPDATE teacher_lesson_logs
    SET lesson_date = COALESCE(${lesson_date}, lesson_date),
        school_year = COALESCE(${schoolYearToPersist}, school_year),
        bimester = COALESCE(${bimesterToPersist}, bimester),
        notes = ${notes},
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
      bimester: bimesterToPersist ?? null,
      notes_length: notes.length,
      observations_length: observations.length,
    },
  })

  return NextResponse.json(updated)
}
