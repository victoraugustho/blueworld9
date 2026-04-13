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
      entry_type,
      is_recurring,
      event_date,
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
      AND (
        COALESCE(is_recurring, TRUE) = TRUE
        OR event_date IS NULL
        OR event_date >= CURRENT_DATE
      )
    ORDER BY event_date ASC NULLS LAST, weekday ASC, start_time ASC
  `

  return NextResponse.json(rows)
}
