import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { clearSessionCookie, revokeSessionsForTeacher } from "@/lib/auth/session"
import bcrypt from "bcryptjs"
import { writeAuditLog } from "@/lib/audit"

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireTeacherApi()
    if (!auth.ok) return auth.response
    const teacherId = auth.teacherId

    const body = await req.json()
    const currentPassword = String(body?.currentPassword ?? "")
    const newPassword = String(body?.newPassword ?? "")

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Senha muito curta" }, { status: 400 })
    }

    const [teacher] = await db`
      SELECT id, password_hash, active, approved
      FROM teachers
      WHERE id = ${teacherId}
      LIMIT 1
    `
    if (!teacher || teacher.active === false || teacher.approved === false) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const ok = await bcrypt.compare(currentPassword, teacher.password_hash)
    if (!ok) {
      await writeAuditLog({
        req,
        action: "profile.password.change",
        status: "failed",
        actor: { id: auth.teacherId, email: auth.teacher.email, role: "teacher" },
        metadata: { reason: "invalid_current" },
      })
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 })
    }

    const hash = await bcrypt.hash(newPassword, 10)

    await db`
      UPDATE teachers
      SET password_hash = ${hash},
          updated_at = NOW()
      WHERE id = ${teacherId}
    `

    await revokeSessionsForTeacher(teacherId)
    const res = NextResponse.json({ ok: true })
    clearSessionCookie(res)

    await writeAuditLog({
      req,
      action: "profile.password.change",
      status: "success",
      actor: { id: auth.teacherId, email: auth.teacher.email, role: "teacher" },
      target: { type: "teacher", id: teacherId },
    })

    return res
  } catch (e) {
    console.error(e)
    await writeAuditLog({
      req,
      action: "profile.password.change",
      status: "failed",
      metadata: { reason: "exception" },
    })
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
