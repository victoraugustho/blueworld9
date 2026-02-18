import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"

type Ctx = { params: Promise<{ id: string }> } // ✅ params como Promise (Next 16 sync-dynamic-apis)

export async function PATCH(_req: NextRequest, ctx: Ctx) {
  // ✅ unwrap correto do params
  const { id } = await ctx.params

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

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
