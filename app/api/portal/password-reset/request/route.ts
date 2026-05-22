import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import crypto from "crypto"
import { writeAuditLog } from "@/lib/audit"

type Country = "BR" | "UY" | "PY"

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function getDocType(country: Country) {
  if (country === "BR") return "CPF"
  if (country === "UY") return "CI_UY"
  return "CI_PY"
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export async function POST(req: NextRequest) {
  try {
    const { country, documentNumber } = await req.json()

    const c = country as Country
    const doc = onlyDigits(documentNumber)

    // Resposta sempre genérica (pra não vazar se existe conta ou não)
    const genericOk = NextResponse.json({
      ok: true,
      message:
        "Se existir uma conta com esses dados, enviaremos um link de redefinição para o email cadastrado.",
    })

    if (!c || !doc || !["BR", "UY", "PY"].includes(c)) return genericOk

    const docType = getDocType(c)

    const [teacher] = await db`
      SELECT id, email, active
      FROM teachers
      WHERE country = ${c}
        AND document_type = ${docType}
        AND document_number = ${doc}
      LIMIT 1
    `

    if (!teacher) return genericOk
    if (teacher.active === false) return genericOk
    if (!teacher.email) return genericOk

    // Rate limit simples: no máximo 3 por 30 min por teacher
    const [rl] = await db`
      SELECT COUNT(*)::int AS count
      FROM password_reset_tokens
      WHERE teacher_id = ${teacher.id}
        AND created_at > now() - interval '30 minutes'
    `
    if ((rl?.count ?? 0) >= 3) {
      await writeAuditLog({
        req: req,
        action: "auth.password_reset.request",
        status: "failed",
        actor: { id: teacher.id, email: teacher.email, role: "teacher" },
        metadata: { reason: "rate_limited" },
      })
      return genericOk
    }

    // cria token cru + hash
    const rawToken = crypto.randomBytes(32).toString("hex") // 64 chars
    const tokenHash = sha256(rawToken)

    // invalida tokens antigos não usados (opcional)
    await db`
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE teacher_id = ${teacher.id}
        AND used_at IS NULL
        AND expires_at > now()
    `

    const expiresAt = new Date(Date.now() + 1000 * 60 * 30) // 30 min

    await db`
      INSERT INTO password_reset_tokens (teacher_id, token_hash, expires_at, ip, user_agent)
      VALUES (
        ${teacher.id},
        ${tokenHash},
        ${expiresAt.toISOString()},
        ${req.headers.get("x-forwarded-for") ?? null},
        ${req.headers.get("user-agent") ?? null}
      )
    `

    const configuredBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const normalizedBaseUrl =
      configuredBaseUrl.replace(/\/+$/, "").replace(/\/portal$/i, "") || "http://localhost:3000"
    const resetUrl = `${normalizedBaseUrl}/reset-password?token=${rawToken}`

    /**
     * ENVIO DE EMAIL
     * Recomendado no seu caso: disparar via n8n (você já usa)
     * Crie um webhook no n8n que envia email e chame aqui.
     */
    const webhook = process.env.N8N_PASSWORD_RESET_WEBHOOK_URL
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: teacher.email,
          subject: "Redefinição de senha - Portal do Professor",
          resetUrl,
        }),
      })
    } else {
      // Sem webhook configurado, não quebra o fluxo (mas não enviará email).
      console.warn("N8N_PASSWORD_RESET_WEBHOOK_URL não definido. ResetUrl:", resetUrl)
    }

    await writeAuditLog({
      req: req,
      action: "auth.password_reset.request",
      status: "success",
      actor: { id: teacher.id, email: teacher.email, role: "teacher" },
    })

    return genericOk
  } catch (e) {
    console.error(e)
    // Mesmo em erro, devolve genérico (pra não vazar info)
    await writeAuditLog({
      req: req,
      action: "auth.password_reset.request",
      status: "failed",
      metadata: { reason: "exception" },
    })
    return NextResponse.json({
      ok: true,
      message:
        "Se existir uma conta com esses dados, enviaremos um link de redefinição para o email cadastrado.",
    })
  }
}
