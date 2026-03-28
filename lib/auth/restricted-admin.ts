export const RESTRICTED_ADMIN_USER_ID = "883d3009-715f-41af-9e51-37ba3a9109f6"

export function isRestrictedAdminUser(teacherId: string | null | undefined) {
  return teacherId === RESTRICTED_ADMIN_USER_ID
}
