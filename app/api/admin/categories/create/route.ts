import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema } from "@/lib/turmas"

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const body = await request.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()

  if (!name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 })
  }

  const [exists] = await db`
    SELECT id
    FROM categories
    WHERE LOWER(name) = LOWER(${name})
    LIMIT 1
  `

  if (exists) {
    return NextResponse.json({ error: "Ja existe uma categoria com esse nome" }, { status: 409 })
  }

  const [category] = await db`
    INSERT INTO categories (name)
    VALUES (${name})
    RETURNING id, name, created_at
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
