import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { SESSION_COOKIE } from "@/lib/auth/constants"
import { clearSessionCookie, hashSessionToken } from "@/lib/auth/session"

type TeacherAuthRow = {
  session_id: string
  expires_at: string
  revoked_at: string | null
  id: string
  approved: boolean
  active: boolean
  role: string | null
  is_admin: boolean | null
  locale: "pt-BR" | "es"
  country: "BR" | "UY" | "PY"
  name: string
  email: string
  avatar_url: string | null
}

function buildUnauthResponse() {
  const res = NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  clearSessionCookie(res)
  return res
}

export async function requireTeacherApi() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) {
    return { ok: false as const, response: buildUnauthResponse() }
  }

  const tokenHash = hashSessionToken(token)
  const [row] = await db`
    SELECT
      s.id AS session_id,
      s.expires_at,
      s.revoked_at,
      t.id,
      t.approved,
      t.active,
      t.role,
      t.is_admin,
      t.locale,
      t.country,
      t.name,
      t.email,
      t.avatar_url
    FROM teacher_sessions s
    JOIN teachers t ON t.id = s.teacher_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1
  `

  if (!row) {
    return { ok: false as const, response: buildUnauthResponse() }
  }

  if (row.revoked_at) {
    return { ok: false as const, response: buildUnauthResponse() }
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, response: buildUnauthResponse() }
  }

  if (row.approved !== true || row.active === false) {
    return { ok: false as const, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }

  return {
    ok: true as const,
    teacher: row as TeacherAuthRow,
    teacherId: row.id,
    sessionId: row.session_id,
  }
}

export async function requireAdminApi() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth

  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"
  if (!isAdmin) {
    return { ok: false as const, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }

  return auth
}
