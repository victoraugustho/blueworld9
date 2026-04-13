import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  let deleted: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    const [removedLog] = await sql`
      DELETE FROM teacher_lesson_logs
      WHERE id = ${id}
      RETURNING id, teacher_id, class_id, lesson_number, lesson_date, bimester
    `

    if (!removedLog) return

    deleted = removedLog

    if (!removedLog.class_id) return

    const removedByNumber = await sql`
      WITH candidate AS (
        SELECT id
        FROM teacher_grade_lessons
        WHERE teacher_id = ${removedLog.teacher_id}
          AND class_id = ${removedLog.class_id}
          AND lesson_number = ${removedLog.lesson_number}
          AND bimester = COALESCE(
            ${removedLog.bimester}::int,
            CASE
              WHEN EXTRACT(MONTH FROM ${removedLog.lesson_date}::date)::int BETWEEN 1 AND 3 THEN 1
              WHEN EXTRACT(MONTH FROM ${removedLog.lesson_date}::date)::int BETWEEN 4 AND 6 THEN 2
              WHEN EXTRACT(MONTH FROM ${removedLog.lesson_date}::date)::int BETWEEN 7 AND 9 THEN 3
              ELSE 4
            END
          )
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      DELETE FROM teacher_grade_lessons g
      USING candidate c
      WHERE g.id = c.id
      RETURNING g.id
    `

    if (removedByNumber.length > 0) return

    await sql`
      WITH candidate AS (
        SELECT id
        FROM teacher_grade_lessons
        WHERE teacher_id = ${removedLog.teacher_id}
          AND class_id = ${removedLog.class_id}
          AND lesson_date = ${removedLog.lesson_date}::date
          AND bimester = COALESCE(
            ${removedLog.bimester}::int,
            CASE
              WHEN EXTRACT(MONTH FROM ${removedLog.lesson_date}::date)::int BETWEEN 1 AND 3 THEN 1
              WHEN EXTRACT(MONTH FROM ${removedLog.lesson_date}::date)::int BETWEEN 4 AND 6 THEN 2
              WHEN EXTRACT(MONTH FROM ${removedLog.lesson_date}::date)::int BETWEEN 7 AND 9 THEN 3
              ELSE 4
            END
          )
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      DELETE FROM teacher_grade_lessons g
      USING candidate c
      WHERE g.id = c.id
    `
  })

  if (!deleted) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.teacher_lesson_logs.delete",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "teacher_lesson_log", id },
    metadata: { teacher_id: deleted.teacher_id },
  })

  return NextResponse.json({ ok: true })
}
