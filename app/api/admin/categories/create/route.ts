import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { name } = await request.json()

  if (!name || name.trim() === "") {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 })
  }

  const [category] = await db`
    INSERT INTO categories (name)
    VALUES (${name})
    RETURNING id, name
  `

  await writeAuditLog({
    req: request,
    action: "admin.categories.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "category", id: category?.id },
    metadata: { name: category?.name ?? name },
  })

  return NextResponse.json({ success: true, category })
}
