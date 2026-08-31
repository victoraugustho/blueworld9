export type PortalUserRole = "admin" | "teacher" | string

export type AuthorizationUser = {
  role?: string | null
  is_admin?: boolean | null
}

export function getPortalUserRole(user: AuthorizationUser): PortalUserRole {
  const role = String(user.role ?? "").trim().toLowerCase()
  if (role) return role

  // Compatibilidade temporária com contas anteriores à adoção de roles.
  return user.is_admin === true ? "admin" : "teacher"
}

export function isAdminUser(user: AuthorizationUser) {
  return getPortalUserRole(user) === "admin" || user.is_admin === true
}
