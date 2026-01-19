import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

export async function GET() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const [teacher] = await db`
    SELECT id, approved, active, country, locale
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `
  if (!teacher || teacher.approved !== true || teacher.active === false) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const rows = await db`
    SELECT
      n.*,
      (nr.read_at IS NOT NULL) AS is_read,
      nr.read_at
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.teacher_id = ${teacherId}
    WHERE n.active = TRUE
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (
        n.audience = 'all'
        OR (n.audience = 'country' AND n.country = ${teacher.country})
        OR (n.audience = 'locale' AND n.locale = ${teacher.locale})
        OR (n.audience = 'teacher' AND n.teacher_id = ${teacherId})
      )
    ORDER BY n.created_at DESC
  `

  return NextResponse.json(rows)
}
