import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await context.params

  const [row] = await db`SELECT * FROM notifications WHERE id = ${id} LIMIT 1`
  if (!row) return NextResponse.json({ error: "Notifica��o n�o encontrada" }, { status: 404 })

  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await context.params
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
    return NextResponse.json({ error: "T�tulo e mensagem s�o obrigat�rios" }, { status: 400 })
  }

  if (!['all', 'country', 'locale', 'teacher'].includes(audience)) {
    return NextResponse.json({ error: "Audience inv�lido" }, { status: 400 })
  }

  if (audience === "country" && !["BR", "UY", "PY"].includes(country)) {
    return NextResponse.json({ error: "Pa�s inv�lido para audience=country" }, { status: 400 })
  }

  if (audience === "locale" && !["pt-BR", "es"].includes(locale)) {
    return NextResponse.json({ error: "Locale inv�lido para audience=locale" }, { status: 400 })
  }

  if (audience === "teacher" && (!teacher_ids || teacher_ids.length === 0)) {
    return NextResponse.json({ error: "Selecione ao menos um professor" }, { status: 400 })
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
      expires_at = ${expires_at}
    WHERE id = ${id}
    RETURNING *
  `

  if (!updated) return NextResponse.json({ error: "Notifica��o n�o encontrada" }, { status: 404 })

  await writeAuditLog({
    req,
    action: "admin.notifications.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "notification", id },
    metadata: { title, audience, country, locale, teacher_id: teacher_id_final, teacher_ids, active, expires_at },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await context.params
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
