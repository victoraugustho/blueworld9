import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { canCreateSpecialNotification, ensureNotificationsSchema } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureNotificationsSchema()

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [notification] = await db`
    SELECT id, audience, country, locale, teacher_id, teacher_ids, type
    FROM notifications
    WHERE id = ${id}
    LIMIT 1
  `

  if (!notification) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 })
  }

  if (notification.type === "special_modal" && !canCreateSpecialNotification(admin.teacherId)) {
    return NextResponse.json({ error: "Sem permissao para notificacao especial." }, { status: 403 })
  }

  const audience = notification.audience
  const country = notification.country
  const locale = notification.locale
  const teacherId = notification.teacher_id
  const teacherIds = Array.isArray(notification.teacher_ids) ? notification.teacher_ids : []

  let teachers: any[] = []

  if (audience === "teacher") {
    if (teacherIds.length > 0) {
      teachers = await db`
        SELECT
          t.id,
          t.name,
          t.email,
          t.country,
          t.locale,
          nr.read_at,
          (nr.read_at IS NOT NULL) AS is_read
        FROM teachers t
        LEFT JOIN notification_reads nr
          ON nr.notification_id = ${id}
         AND nr.teacher_id = t.id
        WHERE t.approved = TRUE
          AND t.active = TRUE
          AND t.id = ANY(${teacherIds}::uuid[])
        ORDER BY t.name ASC
      `
    } else if (teacherId) {
      teachers = await db`
        SELECT
          t.id,
          t.name,
          t.email,
          t.country,
          t.locale,
          nr.read_at,
          (nr.read_at IS NOT NULL) AS is_read
        FROM teachers t
        LEFT JOIN notification_reads nr
          ON nr.notification_id = ${id}
         AND nr.teacher_id = t.id
        WHERE t.approved = TRUE
          AND t.active = TRUE
          AND t.id = ${teacherId}
        ORDER BY t.name ASC
      `
    }
  } else {
    teachers = await db`
      SELECT
        t.id,
        t.name,
        t.email,
        t.country,
        t.locale,
        nr.read_at,
        (nr.read_at IS NOT NULL) AS is_read
      FROM teachers t
      LEFT JOIN notification_reads nr
        ON nr.notification_id = ${id}
       AND nr.teacher_id = t.id
      WHERE t.approved = TRUE
        AND t.active = TRUE
        AND (
          ${audience} = 'all'
          OR (${audience} = 'country' AND t.country = ${country})
          OR (${audience} = 'locale' AND t.locale = ${locale})
        )
      ORDER BY t.name ASC
    `
  }

  const readCount = teachers.filter((teacher: any) => teacher.is_read).length
  const total = teachers.length

  return NextResponse.json({
    total,
    read: readCount,
    unread: total - readCount,
    teachers,
  })
}
