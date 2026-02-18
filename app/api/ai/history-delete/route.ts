import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"

export async function DELETE() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const teacherId = auth.teacherId

  await db`
    DELETE FROM public.ai_conversations
    WHERE teacher_id = ${teacherId}
  `

  return NextResponse.json({ success: true })
}
