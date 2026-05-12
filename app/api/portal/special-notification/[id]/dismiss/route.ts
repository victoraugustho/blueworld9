import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureNotificationsSchema } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const teacherId = auth.teacherId
  const teacher = auth.teacher
  const { id } = await context.params

  await ensureNotificationsSchema()

  const [row] = await db`
    SELECT
      n.id,
      n.audience,
      n.country,
      n.locale,
      n.teacher_id,
      n.teacher_ids,
      COALESCE(n.special_mode, 'once') AS special_mode
    FROM notifications n
    WHERE n.id = ${id}
      AND n.active = TRUE
      AND COALESCE(n.type, 'standard') = 'special_modal'
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (
        n.audience = 'all'
        OR (n.audience = 'country' AND n.country = ${teacher.country})
        OR (n.audience = 'locale' AND n.locale = ${teacher.locale})
        OR (
          n.audience = 'teacher'
          AND (
            n.teacher_id = ${teacherId}
            OR ${teacherId} = ANY(COALESCE(n.teacher_ids, ARRAY[]::uuid[]))
          )
        )
      )
    LIMIT 1
  `

  if (!row) {
    return NextResponse.json({ error: "Notificacao especial nao encontrada." }, { status: 404 })
  }

  if (row.special_mode === "once") {
    await db`
      INSERT INTO notification_reads (notification_id, teacher_id)
      VALUES (${id}, ${teacherId})
      ON CONFLICT (notification_id, teacher_id)
      DO UPDATE SET read_at = NOW()
    `
  }

  await writeAuditLog({
    req,
    action: "notifications.special.dismiss",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "teacher" },
    target: { type: "notification", id },
    metadata: {
      special_mode: row.special_mode,
    },
  })

  return NextResponse.json({ success: true })
}
