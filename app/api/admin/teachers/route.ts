import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const approved = await db`
    SELECT
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
    FROM teachers
    WHERE approved = TRUE AND active = TRUE
    ORDER BY created_at DESC
  `

  const pending = await db`
    SELECT
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
    FROM teachers
    WHERE approved = FALSE AND active = TRUE
    ORDER BY created_at DESC
  `

  const disabled = await db`
    SELECT
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
    FROM teachers
    WHERE active = FALSE
    ORDER BY created_at DESC
  `

  return NextResponse.json({ approved, pending, disabled })
}
