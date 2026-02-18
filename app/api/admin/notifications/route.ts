import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

async function notifyN8N(payload: any) {
  const url = process.env.N8N_NOTIFICATIONS_WEBHOOK_URL
  if (!url) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      // não vaza detalhes pro cliente; só loga no servidor
      const text = await res.text().catch(() => "")
      console.error("[n8n webhook] status:", res.status, text)
    }
  } catch (err) {
    console.error("[n8n webhook] error:", err)
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const rows = await db`
    SELECT *
    FROM notifications
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await req.json()

  const title = body.title?.trim()
  const message = body.message?.trim()
  const rawAudience = body.audience ?? "all"
  const teacherIdsRaw = Array.isArray(body.teacher_ids) ? body.teacher_ids : []
  const teacherIds = Array.from(
    new Set(teacherIdsRaw.map((id: any) => String(id).trim()).filter(Boolean))
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

  if (!title || !message) {
    return NextResponse.json({ error: "Título e mensagem são obrigatórios" }, { status: 400 })
  }

  if (!['all', 'country', 'locale', 'teacher'].includes(audience)) {
    return NextResponse.json({ error: "Audience inválido" }, { status: 400 })
  }

  if (audience === "country" && !["BR", "UY", "PY"].includes(country)) {
    return NextResponse.json({ error: "País inválido para audience=country" }, { status: 400 })
  }

  if (audience === "locale" && !["pt-BR", "es"].includes(locale)) {
    return NextResponse.json({ error: "Locale inválido para audience=locale" }, { status: 400 })
  }

  if (audience === "teacher" && (!teacher_ids || teacher_ids.length === 0)) {
    return NextResponse.json({ error: "Selecione ao menos um professor" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO notifications (
      title, message, audience, country, locale, teacher_id, teacher_ids, active, expires_at, created_by
    )
    VALUES (
      ${title}, ${message}, ${audience}, ${country}, ${locale}, ${teacher_id_final}, ${teacher_ids}::uuid[], ${active}, ${expires_at}, ${admin.teacherId}
    )
    RETURNING *
  `

  // Dispara para o n8n (sem impedir o retorno pro cliente)
  await notifyN8N({
    event: "notification.created",
    notification: created,
    createdBy: admin.teacherId,
    at: new Date().toISOString(),
  })

  await writeAuditLog({
    req,
    action: "admin.notifications.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "notification", id: created?.id },
    metadata: { title, audience, country, locale, teacher_id: teacher_id_final, teacher_ids, active, expires_at },
  })

  return NextResponse.json(created)
}
