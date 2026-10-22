import { getPortalUserRole, type AuthorizationUser } from './authorization'

type SuperAdminUser = AuthorizationUser & { id?: string | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Server-only configuration: never use NEXT_PUBLIC variables or client-supplied flags.
export function isConfiguredSuperAdminId(id: string | null | undefined) {
  if (!id || !uuid.test(id)) return false
  const configured = `${process.env.SUPER_ADMIN_ID ?? ''},${process.env.SUPER_ADMIN_IDS ?? ''}`
    .split(',').map(value => value.trim().toLowerCase()).filter(value => uuid.test(value))
  return configured.includes(id.toLowerCase())
}

export function isSuperAdmin(user: SuperAdminUser) {
  return getPortalUserRole(user) === 'admin' && isConfiguredSuperAdminId(user.id)
}

export function canEditProtectedAccount(actor: SuperAdminUser, targetId: string) {
  return !isConfiguredSuperAdminId(targetId) || isSuperAdmin(actor)
}
