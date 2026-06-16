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

  const [row] = await db`
    SELECT
      n.id,
      n.title,
      n.message,
      n.audience,
      n.country,
      n.locale,
      n.teacher_id,
      n.teacher_ids,
      n.expires_at,
      n.created_at,
      n.type,
      COALESCE(n.special_mode, 'once') AS special_mode,
      nr.read_at
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id
     AND nr.teacher_id = ${teacherId}
    WHERE n.active = TRUE
      AND COALESCE(n.type, 'standard') = 'special_modal'
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
      AND (
        COALESCE(n.special_mode, 'once') = 'until'
        OR nr.read_at IS NULL
      )
    ORDER BY n.created_at DESC
    LIMIT 1
  `

  if (!row) return NextResponse.json(null)

  return NextResponse.json({
    id: row.id,
    title: row.title,
    message: row.message,
    expires_at: row.expires_at,
    created_at: row.created_at,
    special_mode: row.special_mode,
  })
}
