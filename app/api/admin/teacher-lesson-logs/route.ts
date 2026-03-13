import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { searchParams } = new URL(req.url)
  const teacherId = String(searchParams.get("teacherId") ?? "").trim()
  const limitRaw = Number(searchParams.get("limit") ?? 200)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200

  if (!teacherId) {
    return NextResponse.json({ error: "teacherId obrigatório" }, { status: 400 })
  }

  const rows = await db`
    SELECT *
    FROM teacher_lesson_logs
    WHERE teacher_id = ${teacherId}
    ORDER BY lesson_date DESC NULLS LAST, lesson_number DESC, created_at DESC
    LIMIT ${limit}
  `

  return NextResponse.json(rows)
}
