import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireTeacherApi()
    if (!auth.ok) return auth.response
    const teacherId = auth.teacherId

    const body = await req.json()
    const name = String(body?.name ?? "").trim()
    const phone = String(body?.phone ?? "").trim()

    if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })

    const [teacher] = await db`
      SELECT id, active, approved
      FROM teachers
      WHERE id = ${teacherId}
      LIMIT 1
    `
    if (!teacher || teacher.active === false || teacher.approved === false) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    await db`
      UPDATE teachers
      SET name = ${name},
          phone = ${phone},
          updated_at = NOW()
      WHERE id = ${teacherId}
    `

    await writeAuditLog({
      req,
      action: "profile.update",
      status: "success",
      actor: { id: auth.teacherId, email: auth.teacher.email, role: "teacher" },
      target: { type: "teacher", id: teacherId },
      metadata: { fields: ["name", "phone"] },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    await writeAuditLog({
      req,
      action: "profile.update",
      status: "failed",
      metadata: { reason: "exception" },
    })
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
