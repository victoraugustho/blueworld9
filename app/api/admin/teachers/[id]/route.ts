import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type Country = "BR" | "UY" | "PY"
type DocType = "CPF" | "CI_UY" | "CI_PY"

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function docTypeForCountry(country: Country): DocType {
  if (country === "BR") return "CPF"
  if (country === "UY") return "CI_UY"
  return "CI_PY"
}

// buscar professor
export async function GET(req: NextRequest, context: any) {
  const { id } = await context.params

  const [teacher] = await db`
    SELECT
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `

  if (!teacher) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })
  }

  return NextResponse.json(teacher)
}

// atualizar professor
export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params
  const body = await req.json()

  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const phone = onlyDigits(body.phone)

  const country: Country = body.country
  const document_number = onlyDigits(body.document_number)

  const approved = !!body.approved
  const active = body.active !== undefined ? !!body.active : true

  if (!name || !email || !phone || !country || !document_number) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!["BR", "UY", "PY"].includes(country)) {
    return NextResponse.json({ error: "País inválido" }, { status: 400 })
  }

  // Se você tiver trigger no banco que ajusta locale/document_type ao mudar o país,
  // pode remover essas duas linhas. Aqui deixo seguro mesmo sem trigger.
  const document_type: DocType = docTypeForCountry(country)
  const locale = country === "BR" ? "pt-BR" : "es"

  const [updated] = await db`
    UPDATE teachers SET
      name = ${name},
      email = ${email},
      phone = ${phone},
      country = ${country},
      locale = ${locale},
      document_type = ${document_type},
      document_number = ${document_number},
      approved = ${approved},
      active = ${active}
    WHERE id = ${id}
    RETURNING
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, created_at, updated_at
  `

  if (!updated) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}

// aprovar professor
export async function PATCH(req: NextRequest, context: any) {
  const { id } = await context.params

  const [result] = await db`
    UPDATE teachers
    SET approved = TRUE
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

// deletar professor (se quiser manter)
export async function DELETE(req: NextRequest, context: any) {
  const { id } = await context.params

  await db`
    DELETE FROM teachers
    WHERE id = ${id}
  `

  return NextResponse.json({ success: true })
}
