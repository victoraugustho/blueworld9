import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

type Country = "BR" | "UY" | "PY"

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function getDocType(country: Country) {
  if (country === "BR") return "CPF"
  if (country === "UY") return "CI_UY"
  return "CI_PY"
}

export async function POST(request: NextRequest) {
  try {
    const { country, documentNumber, password } = await request.json()

    const c = country as Country
    const doc = onlyDigits(documentNumber)

    if (!c || !doc || !password) {
      return NextResponse.json(
        { error: c === "BR" ? "Documento e senha são obrigatórios" : "Documento y contraseña son obligatorios" },
        { status: 400 }
      )
    }

    if (!["BR", "UY", "PY"].includes(c)) {
      return NextResponse.json({ error: "País inválido" }, { status: 400 })
    }

    const docType = getDocType(c)

    const [teacher] = await db`
      SELECT id, approved, active, password_hash, locale
      FROM teachers
      WHERE country = ${c}
        AND document_type = ${docType}
        AND document_number = ${doc}
      LIMIT 1
    `

    if (!teacher) {
      return NextResponse.json(
        { error: c === "BR" ? "Documento ou senha incorretos" : "Documento o contraseña incorrectos" },
        { status: 401 }
      )
    }

    const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

    if (teacher.active === false) {
      return NextResponse.json(
        { error: locale === "pt-BR" ? "Conta inativa. Contate um administrador." : "Cuenta inactiva. Contacte a un administrador." },
        { status: 403 }
      )
    }

    // ✅ BLOQUEIA LOGIN SE NÃO ESTIVER APROVADO
    if (teacher.approved === false) {
      return NextResponse.json(
        { error: locale === "pt-BR" ? "Seu cadastro ainda não foi aprovado." : "Tu registro aún no fue aprobado." },
        { status: 403 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, teacher.password_hash)
    if (!passwordMatch) {
      return NextResponse.json(
        { error: locale === "pt-BR" ? "Documento ou senha incorretos" : "Documento o contraseña incorrectos" },
        { status: 401 }
      )
    }

    // resposta + cookies
    const response = NextResponse.json({
      success: true,
      teacherId: teacher.id,
      approved: teacher.approved,
      locale,
    })

    // ✅ cookie httpOnly (auth)
    response.cookies.set("teacher_id", String(teacher.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

    // ✅ cookie NÃO httpOnly (somente UI/idioma)
    response.cookies.set("portal_locale", locale, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    // ✅ opcional: guardar país também (útil pra filtrar materiais)
    response.cookies.set("portal_country", c, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (err) {
    console.error("Login error:", err)
    return NextResponse.json({ error: "Erro ao fazer login" }, { status: 500 })
  }
}
