import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PATCH(req: NextRequest, context: any) {
  const { id } = await context.params

  const body = await req.json().catch(() => ({}))
  const active = body.active === true

  const [result] = await db`
    UPDATE teachers
    SET active = ${active}
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
