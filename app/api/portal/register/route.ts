import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { writeAuditLog } from "@/lib/audit"
import { ensureLgpdSchema, getActiveLgpdVersions, getRequestIp, LGPD_POLICY_TYPES } from "@/lib/lgpd"

type Country = "BR" | "UY" | "PY"

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function getDocumentConfig(country: Country) {
  if (country === "BR") return { type: "CPF", min: 11, max: 11 }
  if (country === "UY") return { type: "CI_UY", min: 6, max: 12 }
  return { type: "CI_PY", min: 6, max: 12 }
}

export async function POST(request: NextRequest) {
  try {
    await ensureLgpdSchema()

    const body = await request.json()

    const name = String(body.name ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const phone = onlyDigits(String(body.phone ?? ""))
    const country = String(body.country ?? "") as Country
    const documentNumber = onlyDigits(String(body.documentNumber ?? ""))
    const password = String(body.password ?? "")

    const acceptPrivacy = body.acceptPrivacy === true
    const acceptTerms = body.acceptTerms === true
    const acceptMarketing = body.acceptMarketing === true

    if (!name || !email || !phone || !country || !documentNumber || !password) {
      await writeAuditLog({
        req: request,
        action: "auth.register",
        status: "failed",
        metadata: { reason: "missing_fields", country: country || null, email: email || null },
      })
      return NextResponse.json({ error: "Todos os campos sao obrigatorios" }, { status: 400 })
    }

    if (!acceptPrivacy || !acceptTerms) {
      await writeAuditLog({
        req: request,
        action: "auth.register",
        status: "failed",
        metadata: {
          reason: "missing_lgpd_acceptance",
          country: country || null,
          email: email || null,
          acceptPrivacy,
          acceptTerms,
          acceptMarketing,
        },
      })
      return NextResponse.json(
        { error: "Para continuar, aceite os Termos de Uso e o Aviso de Privacidade." },
        { status: 400 },
      )
    }

    if (!["BR", "UY", "PY"].includes(country)) {
      await writeAuditLog({
        req: request,
        action: "auth.register",
        status: "failed",
        metadata: { reason: "invalid_country", country, email },
      })
      return NextResponse.json({ error: "Pais invalido" }, { status: 400 })
    }

    const doc = getDocumentConfig(country)

    if (documentNumber.length < doc.min || documentNumber.length > doc.max) {
      await writeAuditLog({
        req: request,
        action: "auth.register",
        status: "failed",
        metadata: { reason: "invalid_document", country, email },
      })
      return NextResponse.json({ error: "Documento invalido" }, { status: 400 })
    }

    if (password.length < 6) {
      await writeAuditLog({
        req: request,
        action: "auth.register",
        status: "failed",
        metadata: { reason: "weak_password", country, email },
      })
      return NextResponse.json({ error: "A senha deve ter no minimo 6 caracteres" }, { status: 400 })
    }

    const existing = await db`
      SELECT id
      FROM teachers
      WHERE email = ${email}
         OR (country = ${country} AND document_type = ${doc.type} AND document_number = ${documentNumber})
      LIMIT 1
    `

    if (existing.length > 0) {
      await writeAuditLog({
        req: request,
        action: "auth.register",
        status: "failed",
        metadata: { reason: "already_exists", country, email },
      })
      return NextResponse.json({ error: "E-mail ou documento ja cadastrado" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const activePolicies = await getActiveLgpdVersions()
    const locale = country === "BR" ? "pt-BR" : "es"
    const ip = getRequestIp(request.headers)
    const userAgent = request.headers.get("user-agent")

    let created: any = null

    await db.begin(async (tx) => {
      const sql = (tx as any).sql ?? tx

      const [createdRow] = await sql`
        INSERT INTO teachers (
          name, email, phone, password_hash, approved, active,
          country, document_type, document_number
        )
        VALUES (
          ${name}, ${email}, ${phone}, ${passwordHash}, false, true,
          ${country}, ${doc.type}, ${documentNumber}
        )
        RETURNING id, email
      `

      created = createdRow

      await sql`
        INSERT INTO teacher_policy_acceptances (
          teacher_id,
          policy_type,
          policy_version,
          accepted,
          accepted_at,
          ip,
          user_agent,
          locale
        )
        VALUES
          (${createdRow.id}, ${LGPD_POLICY_TYPES.PRIVACY_NOTICE}, ${activePolicies[LGPD_POLICY_TYPES.PRIVACY_NOTICE]}, TRUE, NOW(), ${ip}, ${userAgent}, ${locale}),
          (${createdRow.id}, ${LGPD_POLICY_TYPES.TERMS_OF_USE}, ${activePolicies[LGPD_POLICY_TYPES.TERMS_OF_USE]}, TRUE, NOW(), ${ip}, ${userAgent}, ${locale}),
          (${createdRow.id}, ${LGPD_POLICY_TYPES.MARKETING_COMMUNICATIONS}, ${activePolicies[LGPD_POLICY_TYPES.MARKETING_COMMUNICATIONS]}, ${acceptMarketing}, NOW(), ${ip}, ${userAgent}, ${locale})
      `
    })

    await writeAuditLog({
      req: request,
      action: "auth.register",
      status: "success",
      actor: { id: created?.id ?? null, email: created?.email ?? email, role: "teacher" },
      metadata: {
        country,
        lgpd: {
          acceptedPrivacy: true,
          acceptedTerms: true,
          acceptedMarketing: acceptMarketing,
          versions: activePolicies,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message:
        country === "BR"
          ? "Cadastro realizado com sucesso. Aguarde aprovacao."
          : "Registro realizado con exito. Espere la aprobacion.",
    })
  } catch (err: any) {
    console.error("Registration error:", err)
    await writeAuditLog({
      req: request,
      action: "auth.register",
      status: "failed",
      metadata: { reason: "exception" },
    })
    return NextResponse.json({ error: "Erro inesperado ao cadastrar." }, { status: 500 })
  }
}
