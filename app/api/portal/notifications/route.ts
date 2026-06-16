import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { ensureNotificationsSchema } from "@/lib/notifications"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

export async function GET() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const teacherId = auth.teacherId
  const teacher = auth.teacher
  const locale = await getEffectivePortalLocale(teacher)

  await ensureNotificationsSchema()

  const rows = await db`
    SELECT
      n.*,
      (nr.read_at IS NOT NULL) AS is_read,
      nr.read_at
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.teacher_id = ${teacherId}
    WHERE n.active = TRUE
      AND COALESCE(n.type, 'standard') = 'standard'
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (
        n.audience = 'all'
        OR (n.audience = 'country' AND n.country = ${teacher.country})
        OR (n.audience = 'locale' AND n.locale = ${locale})
        OR (
          n.audience = 'teacher'
          AND (
            n.teacher_id = ${teacherId}
            OR ${teacherId} = ANY(COALESCE(n.teacher_ids, ARRAY[]::uuid[]))
          )
        )
      )
    ORDER BY n.created_at DESC
  `

  return NextResponse.json(rows)
}
