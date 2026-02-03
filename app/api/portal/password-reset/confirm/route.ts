import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import crypto from "crypto"

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    const rawToken = String(token ?? "").trim()
    const newPassword = String(password ?? "")

    if (!rawToken || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Token inválido ou senha muito curta (mínimo 8 caracteres)." },
        { status: 400 }
      )
    }

    const tokenHash = sha256(rawToken)
    const hash = await bcrypt.hash(newPassword, 10)

    // ✅ transação segura (postgres.js style)
    await db.begin(async (tx) => {
      const sql = (tx as any).sql ?? tx

      const [row] = await sql`
        SELECT prt.id, prt.teacher_id, prt.expires_at, prt.used_at
        FROM password_reset_tokens prt
        WHERE prt.token_hash = ${tokenHash}
        LIMIT 1
        FOR UPDATE
      `

      if (!row) throw Object.assign(new Error("TOKEN_INVALID"), { status: 400 })

      const expired = new Date(row.expires_at).getTime() < Date.now()
      if (expired) throw Object.assign(new Error("TOKEN_EXPIRED"), { status: 400 })
      if (row.used_at) throw Object.assign(new Error("TOKEN_USED"), { status: 400 })

      await sql`
        UPDATE teachers
        SET password_hash = ${hash}, updated_at = now()
        WHERE id = ${row.teacher_id}
      `

      await sql`
        UPDATE password_reset_tokens
        SET used_at = now()
        WHERE id = ${row.id}
      `

      await sql`
        UPDATE password_reset_tokens
        SET used_at = now()
        WHERE teacher_id = ${row.teacher_id}
          AND used_at IS NULL
          AND expires_at > now()
      `
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error(e)

    // erros “controlados” dentro do begin
    if (e?.message === "TOKEN_INVALID") {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 })
    }
    if (e?.message === "TOKEN_EXPIRED") {
      return NextResponse.json({ error: "Token expirado." }, { status: 400 })
    }
    if (e?.message === "TOKEN_USED") {
      return NextResponse.json({ error: "Token já utilizado." }, { status: 400 })
    }

    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}
