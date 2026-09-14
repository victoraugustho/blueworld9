import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherPermissionApi } from "@/lib/auth/require"

export async function DELETE() {
  const auth = await requireTeacherPermissionApi("ia")
  if (!auth.ok) return auth.response
  const teacherId = auth.teacherId

  await db`
    DELETE FROM public.ai_conversations
    WHERE teacher_id = ${teacherId}
  `

  return NextResponse.json({ success: true })
}
