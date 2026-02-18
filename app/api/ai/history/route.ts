import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const teacherId = auth.teacherId

  const [conv] = await db`
    SELECT id
    FROM ai_conversations
    WHERE teacher_id = ${teacherId}
    ORDER BY created_at ASC
    LIMIT 1
  `
  if (!conv) return NextResponse.json([])

  const rows = await db`
    SELECT role, content, created_at
    FROM ai_messages
    WHERE conversation_id = ${conv.id}
    ORDER BY created_at ASC
    LIMIT 200
  `

  return NextResponse.json(rows)
}
