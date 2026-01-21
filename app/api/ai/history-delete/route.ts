import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function DELETE() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  await db`
    DELETE FROM ai_messages
    WHERE teacher_id = ${teacherId}
  `

  return NextResponse.json({ success: true })
}
