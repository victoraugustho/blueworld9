import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

async function requireAdmin() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) return null

  const [t] = await db`
    SELECT id, approved, active, role
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `
  if (!t || t.approved !== true || t.active === false) return null
  if (t.role !== "admin") return null
  return { teacherId }
}

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
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const rows = await db`
    SELECT *
    FROM notifications
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()

  const title = body.title?.trim()
  const message = body.message?.trim()
  const audience = body.audience ?? "all"
  const country = body.country ?? null
  const locale = body.locale ?? null
  const teacher_id = body.teacher_id ?? null
  const active = body.active !== undefined ? !!body.active : true
  const expires_at = body.expires_at ? new Date(body.expires_at) : null

  if (!title || !message) {
    return NextResponse.json({ error: "Título e mensagem são obrigatórios" }, { status: 400 })
  }

  if (!["all", "country", "locale", "teacher"].includes(audience)) {
    return NextResponse.json({ error: "Audience inválido" }, { status: 400 })
  }

  if (audience === "country" && !["BR", "UY", "PY"].includes(country)) {
    return NextResponse.json({ error: "País inválido para audience=country" }, { status: 400 })
  }

  if (audience === "locale" && !["pt-BR", "es"].includes(locale)) {
    return NextResponse.json({ error: "Locale inválido para audience=locale" }, { status: 400 })
  }

  if (audience === "teacher" && !teacher_id) {
    return NextResponse.json({ error: "teacher_id obrigatório para audience=teacher" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO notifications (title, message, audience, country, locale, teacher_id, active, expires_at, created_by)
    VALUES (${title}, ${message}, ${audience}, ${country}, ${locale}, ${teacher_id}, ${active}, ${expires_at}, ${admin.teacherId})
    RETURNING *
  `

  // Dispara para o n8n (sem impedir o retorno pro cliente)
  await notifyN8N({
    event: "notification.created",
    notification: created,
    createdBy: admin.teacherId,
    at: new Date().toISOString(),
  })

  return NextResponse.json(created)
}
