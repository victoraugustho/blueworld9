import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureTurmasSchema } from "@/lib/turmas"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const materials = await db`
    SELECT
      m.*,
      c.name AS category_name,
      COALESCE(m.access_scope, 'all') AS access_scope,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT mta.teacher_id), NULL),
        ARRAY[]::uuid[]
      ) AS teacher_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL),
        ARRAY[]::text[]
      ) AS teacher_names
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    LEFT JOIN material_teacher_access mta ON mta.material_id = m.id
    LEFT JOIN teachers t ON t.id = mta.teacher_id
    GROUP BY m.id, c.name
    ORDER BY m.created_at DESC
  `

  return NextResponse.json(materials)
}
