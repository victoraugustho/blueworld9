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

export async function GET(req: NextRequest, context: any) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await context.params

  const [row] = await db`SELECT * FROM notifications WHERE id = ${id} LIMIT 1`
  if (!row) return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 })

  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, context: any) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await context.params
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

  const [updated] = await db`
    UPDATE notifications SET
      title = ${title},
      message = ${message},
      audience = ${audience},
      country = ${country},
      locale = ${locale},
      teacher_id = ${teacher_id},
      active = ${active},
      expires_at = ${expires_at}
    WHERE id = ${id}
    RETURNING *
  `

  if (!updated) return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, context: any) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await context.params
  await db`DELETE FROM notifications WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
