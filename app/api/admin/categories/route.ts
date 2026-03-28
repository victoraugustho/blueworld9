import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema } from "@/lib/turmas"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const categories = await db`
    SELECT
      c.id,
      c.name,
      c.created_at,
      COUNT(DISTINCT m.id)::int AS material_count,
      COUNT(DISTINCT tc.teacher_id)::int AS teacher_count
    FROM categories c
    LEFT JOIN materials m ON m.category_id = c.id
    LEFT JOIN teacher_categories tc ON tc.category_id = c.id
    GROUP BY c.id, c.name, c.created_at
    ORDER BY c.name ASC
  `

  return NextResponse.json(categories)
}

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

  const [created] = await db`
    INSERT INTO categories (name)
    VALUES (${name})
    RETURNING id, name, created_at
  `

  await writeAuditLog({
    req: request,
    action: "admin.categories.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "category", id: created?.id },
    metadata: { name: created?.name ?? name },
  })

  return NextResponse.json({ success: true, category: created })
}
