import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

async function requireTeacher() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) return null

  const [teacher] = await db`
    SELECT id, approved, active
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `
  if (!teacher || teacher.approved !== true || teacher.active === false) return null
  return { teacherId }
}

export async function POST(req: NextRequest, context: any) {
  const auth = await requireTeacher()
  if (!auth) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

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
  const auth = await requireTeacher()
  if (!auth) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { id } = await context.params

  await db`
    DELETE FROM notification_reads
    WHERE notification_id = ${id}
      AND teacher_id = ${auth.teacherId}
  `

  return NextResponse.json({ success: true })
}
