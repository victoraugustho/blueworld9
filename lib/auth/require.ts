import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { SESSION_COOKIE } from "@/lib/auth/constants"
import { clearSessionCookie, hashSessionToken } from "@/lib/auth/session"
import { isAdminUser } from "@/lib/auth/authorization"
import {
  hasTeacherPortalPermission,
  normalizeTeacherPortalPermissions,
  type TeacherPortalPermissionKey,
  type TeacherPortalPermissions,
} from "@/lib/auth/teacher-permissions"
import {
  normalizeTeacherContentPermissions,
  type TeacherContentPermissions,
} from "@/lib/auth/teacher-content-permissions"

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
  can_download: boolean
  portal_permissions: TeacherPortalPermissions
  content_permissions: TeacherContentPermissions
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
      t.avatar_url,
      COALESCE(
        NULLIF(to_jsonb(t)->>'can_download', '')::boolean,
        TRUE
      ) AS can_download,
      COALESCE(
        to_jsonb(t)->'portal_permissions',
        '{"aulas":true,"agenda_notas":true,"materiais":true,"projetos":true,"ia":true}'::jsonb
      ) AS portal_permissions,
      COALESCE(
        to_jsonb(t)->'content_permissions',
        '{"aulas":{"mode":"inherit","category_ids":[],"item_ids":[]},"materiais":{"mode":"inherit","category_ids":[],"item_ids":[]},"projetos":{"mode":"inherit","category_ids":[],"item_ids":[]}}'::jsonb
      ) AS content_permissions
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
    teacher: {
      ...row,
      portal_permissions: normalizeTeacherPortalPermissions(row.portal_permissions),
      content_permissions: normalizeTeacherContentPermissions(row.content_permissions),
    } as TeacherAuthRow,
    teacherId: row.id,
    sessionId: row.session_id,
  }
}

export async function requireTeacherPermissionApi(permission: TeacherPortalPermissionKey) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth

  if (!hasTeacherPortalPermission(auth.teacher, permission)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Este módulo não está liberado para o seu acesso." },
        { status: 403 },
      ),
    }
  }

  return auth
}

export async function requireAdminApi() {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth

  if (!isAdminUser(auth.teacher)) {
    return { ok: false as const, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }

  return auth
}
