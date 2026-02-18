import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(req: NextRequest, context: any) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  const { id } = await context.params

  const body = await req.json().catch(() => ({}))
  const active = body.active === true

  const [result] = await db`
    UPDATE teachers
    SET active = ${active}
    WHERE id = ${id}
    RETURNING
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
  `

  if (!result) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: active ? "admin.teachers.enable" : "admin.teachers.disable",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "teacher", id },
    metadata: { active },
  })

  return NextResponse.json(result)
}
