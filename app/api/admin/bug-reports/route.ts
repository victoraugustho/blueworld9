import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { BUG_REPORTS_OWNER_ID } from "@/lib/bug-reports"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  if (auth.teacherId !== BUG_REPORTS_OWNER_ID) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 })
  }

  const rows = await db`
    SELECT
      r.*,
      t.name AS teacher_name,
      t.email AS teacher_email
    FROM bug_reports r
    JOIN teachers t ON t.id = r.teacher_id
    ORDER BY r.created_at DESC
  `

  return NextResponse.json(rows)
}
