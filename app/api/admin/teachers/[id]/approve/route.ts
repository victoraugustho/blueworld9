import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> } // ✅ params como Promise (Next 16 sync-dynamic-apis)

export async function PATCH(_req: NextRequest, ctx: Ctx) {
  // ✅ unwrap correto do params
  const { id } = await ctx.params

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  // ✅ (recomendado) checar admin
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const [me] = await db`
    SELECT role, is_admin
    FROM public.teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `
  const isAdmin = me?.is_admin === true || me?.role === "admin"
  if (!isAdmin) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  // ✅ aprova professor
  const [result] = await db`
    UPDATE public.teachers
    SET approved = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
  `

  if (!result) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })
  }

  return NextResponse.json(result)
}
