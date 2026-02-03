import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

export async function PUT(req: NextRequest) {
  try {
    const teacherId = (await cookies()).get("teacher_id")?.value
    if (!teacherId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

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

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
