import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const [deleted] = await db`
    DELETE FROM teacher_lesson_logs
    WHERE id = ${id}
    RETURNING id, teacher_id
  `

  if (!deleted) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
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
