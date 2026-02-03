import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function PUT(req: NextRequest) {
  try {
    const teacherId = (await cookies()).get("teacher_id")?.value
    if (!teacherId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

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
    if (!ok) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 })

    const hash = await bcrypt.hash(newPassword, 10)

    await db`
      UPDATE teachers
      SET password_hash = ${hash},
          updated_at = NOW()
      WHERE id = ${teacherId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
