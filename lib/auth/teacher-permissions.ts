import { isAdminUser } from "@/lib/auth/authorization"

export const TEACHER_PORTAL_PERMISSION_KEYS = [
  "aulas",
  "agenda_notas",
  "materiais",
  "projetos",
  "ia",
] as const

export type TeacherPortalPermissionKey = (typeof TEACHER_PORTAL_PERMISSION_KEYS)[number]

export type TeacherPortalPermissions = Record<TeacherPortalPermissionKey, boolean>

export const DEFAULT_TEACHER_PORTAL_PERMISSIONS: TeacherPortalPermissions = {
  aulas: true,
  agenda_notas: true,
  materiais: true,
  projetos: true,
  ia: true,
}

type PermissionUser = {
  role?: string | null
  is_admin?: boolean | null
  portal_permissions?: unknown
}

export function normalizeTeacherPortalPermissions(value: unknown): TeacherPortalPermissions {
  let raw = value

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = null
    }
  }

  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}

  return TEACHER_PORTAL_PERMISSION_KEYS.reduce<TeacherPortalPermissions>(
    (permissions, key) => {
      permissions[key] = typeof source[key] === "boolean"
        ? source[key] as boolean
        : DEFAULT_TEACHER_PORTAL_PERMISSIONS[key]
      return permissions
    },
    { ...DEFAULT_TEACHER_PORTAL_PERMISSIONS },
  )
}

export function hasTeacherPortalPermission(
  user: PermissionUser,
  permission: TeacherPortalPermissionKey,
) {
  if (isAdminUser(user)) return true
  return normalizeTeacherPortalPermissions(user.portal_permissions)[permission]
}

