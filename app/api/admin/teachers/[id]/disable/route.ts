import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { canEditProtectedAccount, isConfiguredSuperAdminId } from "@/lib/auth/super-admin"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(req: NextRequest, context: any) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  const { id } = await context.params
  if (!canEditProtectedAccount({...admin.teacher,id:admin.teacherId},id)) {
    return NextResponse.json({error:"Somente o SuperAdmin pode editar uma conta protegida."},{status:403})
  }

  const body = await req.json().catch(() => ({}))
  const active = body?.active === true
  if (isConfiguredSuperAdminId(id) && !active) {
    return NextResponse.json({error:"Uma conta protegida pelo .env não pode ser desativada."},{status:409})
  }

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
