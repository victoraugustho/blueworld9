import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import {
  canCreateSpecialNotification,
  ensureNotificationsSchema,
  type NotificationType,
  type SpecialMode,
} from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

function parseNotificationType(input: unknown): NotificationType {
  return input === "special_modal" ? "special_modal" : "standard"
}

function parseSpecialMode(input: unknown): SpecialMode {
  return input === "until" ? "until" : "once"
}

export async function GET(_req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureNotificationsSchema()

  const { id } = await context.params

  const [row] = await db`SELECT * FROM notifications WHERE id = ${id} LIMIT 1`
  if (!row) return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 })
  if (row.type === "special_modal" && !canCreateSpecialNotification(admin.teacherId)) {
    return NextResponse.json({ error: "Sem permissao para acessar notificacao especial." }, { status: 403 })
  }

  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureNotificationsSchema()

  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const [existing] = await db`
    SELECT id, type
    FROM notifications
    WHERE id = ${id}
    LIMIT 1
  `

  if (!existing) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 })
  }

  const title = String(body.title ?? "").trim()
  const message = String(body.message ?? "").trim()
  const rawAudience = body.audience ?? "all"
  const teacherIdsRaw = Array.isArray(body.teacher_ids) ? body.teacher_ids : []
  const teacherIds = Array.from(
    new Set(teacherIdsRaw.map((item: unknown) => String(item).trim()).filter(Boolean)),
  )
  const teacher_id = body.teacher_id ?? (teacherIds[0] ?? null)
  const audience = teacherIds.length > 0 ? "teacher" : rawAudience
  const country = audience === "country" ? body.country ?? null : null
  const locale = audience === "locale" ? body.locale ?? null : null
  const active = body.active !== undefined ? !!body.active : true
  const expires_at = body.expires_at ? new Date(body.expires_at) : null
  const teacher_ids =
    audience === "teacher" ? (teacherIds.length > 0 ? teacherIds : teacher_id ? [teacher_id] : null) : null
  const teacher_id_final = audience === "teacher" ? teacher_id : null
  const type = parseNotificationType(body.type)
  const special_mode: SpecialMode | null = type === "special_modal" ? parseSpecialMode(body.special_mode) : null

  if (!title || !message) {
    return NextResponse.json({ error: "Titulo e mensagem sao obrigatorios" }, { status: 400 })
  }

  if (!(["all", "country", "locale", "teacher"] as const).includes(audience)) {
    return NextResponse.json({ error: "Audience invalido" }, { status: 400 })
  }

  if (audience === "country" && !(["BR", "UY", "PY"] as const).includes(country)) {
    return NextResponse.json({ error: "Pais invalido para audience=country" }, { status: 400 })
  }

  if (audience === "locale" && !(["pt-BR", "es"] as const).includes(locale)) {
    return NextResponse.json({ error: "Locale invalido para audience=locale" }, { status: 400 })
  }

  if (audience === "teacher" && (!teacher_ids || teacher_ids.length === 0)) {
    return NextResponse.json({ error: "Selecione ao menos um professor" }, { status: 400 })
  }

  const touchesSpecialNotification = existing.type === "special_modal" || type === "special_modal"
  if (touchesSpecialNotification && !canCreateSpecialNotification(admin.teacherId)) {
    return NextResponse.json({ error: "Sem permissao para editar notificacao especial." }, { status: 403 })
  }

  if (type === "special_modal" && special_mode === "until" && !expires_at) {
    return NextResponse.json(
      { error: "Notificacao especial com exibicao ate data requer expiracao." },
      { status: 400 },
    )
  }

  const [updated] = await db`
    UPDATE notifications SET
      title = ${title},
      message = ${message},
      audience = ${audience},
      country = ${country},
      locale = ${locale},
      teacher_id = ${teacher_id_final},
      teacher_ids = ${teacher_ids}::uuid[],
      active = ${active},
      expires_at = ${expires_at},
      type = ${type},
      special_mode = ${special_mode}
    WHERE id = ${id}
    RETURNING *
  `

  if (!updated) return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 })

  await writeAuditLog({
    req,
    action: "admin.notifications.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "notification", id },
    metadata: {
      title,
      audience,
      country,
      locale,
      teacher_id: teacher_id_final,
      teacher_ids,
      active,
      expires_at,
      type,
      special_mode,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureNotificationsSchema()

  const { id } = await context.params

  const [existing] = await db`
    SELECT id, type
    FROM notifications
    WHERE id = ${id}
    LIMIT 1
  `

  if (!existing) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 })
  }

  if (existing.type === "special_modal" && !canCreateSpecialNotification(admin.teacherId)) {
    return NextResponse.json({ error: "Sem permissao para excluir notificacao especial." }, { status: 403 })
  }

  await db`DELETE FROM notifications WHERE id = ${id}`

  await writeAuditLog({
    req,
    action: "admin.notifications.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "notification", id },
  })

  return NextResponse.json({ success: true })
}
