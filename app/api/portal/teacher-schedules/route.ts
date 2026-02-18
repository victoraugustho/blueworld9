import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const rows = await db`
    SELECT *
    FROM teacher_schedules
    WHERE teacher_id = ${auth.teacherId}
      AND active = TRUE
    ORDER BY weekday ASC, start_time ASC
  `

  return NextResponse.json(rows)
}
