import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

type Country = "BR" | "UY" | "PY"

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function getDocumentConfig(country: Country) {
  if (country === "BR") return { type: "CPF", min: 11, max: 11 }
  // UY e PY: CI (varia tamanho; vamos aceitar 6–12 por enquanto)
  if (country === "UY") return { type: "CI_UY", min: 6, max: 12 }
  return { type: "CI_PY", min: 6, max: 12 }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const phone = onlyDigits(body.phone)
    const country: Country = body.country
    const documentNumber = onlyDigits(body.documentNumber)
    const password = body.password

    if (!name || !email || !phone || !country || !documentNumber || !password) {
      return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 })
    }

    if (!["BR", "UY", "PY"].includes(country)) {
      return NextResponse.json({ error: "País inválido" }, { status: 400 })
    }

    const doc = getDocumentConfig(country)

    if (documentNumber.length < doc.min || documentNumber.length > doc.max) {
      return NextResponse.json({ error: "Documento inválido" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter no mínimo 6 caracteres" }, { status: 400 })
    }

    // Verificar email OU documento já existente
    const existing = await db`
      SELECT id FROM teachers
      WHERE email = ${email}
         OR (country = ${country} AND document_type = ${doc.type} AND document_number = ${documentNumber})
      LIMIT 1
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "E-mail ou documento já cadastrado" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await db`
      INSERT INTO teachers (
        name, email, phone, password_hash, approved, active,
        country, document_type, document_number
      )
      VALUES (
        ${name}, ${email}, ${phone}, ${passwordHash}, false, true,
        ${country}, ${doc.type}, ${documentNumber}
      )
    `

    return NextResponse.json({
      success: true,
      message:
        country === "BR"
          ? "Cadastro realizado com sucesso. Aguarde aprovação."
          : "Registro realizado con éxito. Espere la aprobación.",
    })
  } catch (err: any) {
    console.error("Registration error:", err)
    return NextResponse.json({ error: "Erro inesperado ao cadastrar." }, { status: 500 })
  }
}
