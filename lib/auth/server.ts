import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { SESSION_COOKIE } from "@/lib/auth/constants"
import { hashSessionToken } from "@/lib/auth/session"
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

type TeacherRow = {
  id: string
  name: string
  email: string
  approved: boolean
  active: boolean
  session_expires_at: string
  locale: "pt-BR" | "es"
  country: "BR" | "UY" | "PY"
  role: string | null
  is_admin: boolean | null
  avatar_url: string | null
  can_download: boolean
  portal_permissions: TeacherPortalPermissions
  content_permissions: TeacherContentPermissions
}

export async function getTeacherFromSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashSessionToken(token)

  const [row] = await db`
    SELECT
      s.expires_at AS session_expires_at,
      s.revoked_at,
      t.id,
      t.name,
      t.email,
      t.approved,
      t.active,
      t.locale,
      t.country,
      t.role,
      t.is_admin,
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

  if (!row) return null
  if (row.revoked_at) return null
  if (new Date(row.session_expires_at).getTime() <= Date.now()) return null

  return {
    ...row,
    portal_permissions: normalizeTeacherPortalPermissions(row.portal_permissions),
    content_permissions: normalizeTeacherContentPermissions(row.content_permissions),
  } as TeacherRow
}

export async function requireTeacherPermissionPage(permission: TeacherPortalPermissionKey) {
  const teacher = await requireTeacherPage()
  if (!hasTeacherPortalPermission(teacher, permission)) {
    redirect("/portal/dashboard?acesso=negado")
  }
  return teacher
}

export async function requireTeacherPage() {
  const teacher = await getTeacherFromSession()
  if (!teacher || teacher.approved !== true || teacher.active === false) {
    redirect("/")
  }
  return teacher
}

export async function requireAdminPage() {
  const teacher = await requireTeacherPage()
  if (!isAdminUser(teacher)) {
    redirect("/portal/dashboard")
  }
  return teacher
}
