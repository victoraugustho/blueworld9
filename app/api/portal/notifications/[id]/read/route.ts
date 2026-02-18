import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"

export async function POST(req: NextRequest, context: any) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const { id } = await context.params

  await db`
    INSERT INTO notification_reads (notification_id, teacher_id)
    VALUES (${id}, ${auth.teacherId})
    ON CONFLICT (notification_id, teacher_id)
    DO UPDATE SET read_at = NOW()
  `

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, context: any) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const { id } = await context.params

  await db`
    DELETE FROM notification_reads
    WHERE notification_id = ${id}
      AND teacher_id = ${auth.teacherId}
  `

  return NextResponse.json({ success: true })
}






