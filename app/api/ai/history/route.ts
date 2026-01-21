import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

export async function GET() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

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
