import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

type RouteParams = { id: string }

export async function PUT(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const { id } = await params
  const reminderId = String(id ?? "").trim()
  if (!reminderId) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json()
  const hasContent = typeof body.content === "string"
  const hasDone = typeof body.done === "boolean"

  if (!hasContent && !hasDone) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
  }

  if (hasContent) {
    const content = String(body.content ?? "").trim()
    if (!content) {
      return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 })
    }
  }

  const content = hasContent ? String(body.content ?? "").trim() : null
  const done = hasDone ? Boolean(body.done) : null

  const [updated] =
    hasContent && hasDone
      ? await db`
          UPDATE teacher_reminders
          SET content = ${content},
              done = ${done}
          WHERE id = ${reminderId}
            AND teacher_id = ${auth.teacherId}
          RETURNING *
        `
      : hasContent
        ? await db`
            UPDATE teacher_reminders
            SET content = ${content}
            WHERE id = ${reminderId}
              AND teacher_id = ${auth.teacherId}
            RETURNING *
          `
        : await db`
            UPDATE teacher_reminders
            SET done = ${done}
            WHERE id = ${reminderId}
              AND teacher_id = ${auth.teacherId}
            RETURNING *
          `

  if (!updated) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "teacher.reminders.update",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "teacher_reminder", id: reminderId },
    metadata: {
      content_length: hasContent ? content?.length ?? 0 : null,
      done,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const { id } = await params
  const reminderId = String(id ?? "").trim()
  if (!reminderId) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const [deleted] = await db`
    DELETE FROM teacher_reminders
    WHERE id = ${reminderId}
      AND teacher_id = ${auth.teacherId}
    RETURNING id
  `

  if (!deleted) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "teacher.reminders.delete",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "teacher_reminder", id: reminderId },
  })

  return NextResponse.json({ ok: true })
}
