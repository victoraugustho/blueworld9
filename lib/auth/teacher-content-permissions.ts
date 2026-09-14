import { isAdminUser } from "@/lib/auth/authorization"

export const TEACHER_CONTENT_AREAS = ["aulas", "materiais", "projetos"] as const

export type TeacherContentArea = (typeof TEACHER_CONTENT_AREAS)[number]
export type TeacherContentAccessMode = "inherit" | "specific"

export type TeacherContentScope = {
  mode: TeacherContentAccessMode
  category_ids: string[]
  item_ids: string[]
}

export type TeacherContentPermissions = Record<TeacherContentArea, TeacherContentScope>

export const DEFAULT_TEACHER_CONTENT_PERMISSIONS: TeacherContentPermissions = {
  aulas: { mode: "inherit", category_ids: [], item_ids: [] },
  materiais: { mode: "inherit", category_ids: [], item_ids: [] },
  projetos: { mode: "inherit", category_ids: [], item_ids: [] },
}

type ContentPermissionUser = {
  role?: string | null
  is_admin?: boolean | null
  content_permissions?: unknown
}

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  )
}

export function normalizeTeacherContentPermissions(value: unknown): TeacherContentPermissions {
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

  return TEACHER_CONTENT_AREAS.reduce<TeacherContentPermissions>((permissions, area) => {
    const areaValue = source[area]
    const areaSource = areaValue && typeof areaValue === "object" && !Array.isArray(areaValue)
      ? areaValue as Record<string, unknown>
      : {}

    permissions[area] = {
      mode: areaSource.mode === "specific" ? "specific" : "inherit",
      category_ids: uniqueIds(areaSource.category_ids),
      item_ids: uniqueIds(areaSource.item_ids),
    }
    return permissions
  }, {
    aulas: { ...DEFAULT_TEACHER_CONTENT_PERMISSIONS.aulas },
    materiais: { ...DEFAULT_TEACHER_CONTENT_PERMISSIONS.materiais },
    projetos: { ...DEFAULT_TEACHER_CONTENT_PERMISSIONS.projetos },
  })
}

export function hasTeacherContentAccess(
  user: ContentPermissionUser,
  area: TeacherContentArea,
  itemId: unknown,
  categoryId?: unknown,
) {
  if (isAdminUser(user)) return true

  const scope = normalizeTeacherContentPermissions(user.content_permissions)[area]
  if (scope.mode === "inherit") return true

  const normalizedItemId = String(itemId ?? "").trim()
  const normalizedCategoryId = String(categoryId ?? "").trim()

  return (
    (normalizedItemId !== "" && scope.item_ids.includes(normalizedItemId))
    || (normalizedCategoryId !== "" && scope.category_ids.includes(normalizedCategoryId))
  )
}

export function resolveTeacherContentAccess(
  user: ContentPermissionUser,
  area: TeacherContentArea,
  allowedByInheritedRules: boolean,
  itemId: unknown,
  categoryId?: unknown,
) {
  if (isAdminUser(user)) return allowedByInheritedRules

  const scope = normalizeTeacherContentPermissions(user.content_permissions)[area]
  if (scope.mode === "inherit") return allowedByInheritedRules
  return hasTeacherContentAccess(user, area, itemId, categoryId)
}
