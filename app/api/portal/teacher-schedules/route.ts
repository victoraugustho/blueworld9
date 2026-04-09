import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { ensureGradebookSchema } from "@/lib/gradebook"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const rows = await db`
    SELECT
      id,
      teacher_id,
      class_id,
      class_label,
      weekday,
      start_time,
      end_time,
      timezone,
      active,
      created_at,
      updated_at
    FROM teacher_schedules
    WHERE teacher_id = ${auth.teacherId}
      AND active = TRUE
    ORDER BY weekday ASC, start_time ASC
  `

  return NextResponse.json(rows)
}
