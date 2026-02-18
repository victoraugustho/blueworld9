import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const materials = await db`
    SELECT
      m.*,
      c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    ORDER BY m.created_at DESC
  `

  // m.language já vem do banco (default pt-BR)
  return NextResponse.json(materials)
}
