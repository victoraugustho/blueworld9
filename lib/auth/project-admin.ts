function parseProjectAdminIds() {
  const ids = new Set<string>()

  const combined = String(process.env.PROJECTS_ADMIN_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  for (const id of combined) ids.add(id)

  const id1 = String(process.env.PROJECTS_ADMIN_ID_1 ?? "").trim()
  const id2 = String(process.env.PROJECTS_ADMIN_ID_2 ?? "").trim()
  if (id1) ids.add(id1)
  if (id2) ids.add(id2)

  return ids
}

export function canManageProjects(teacherId: string | null | undefined) {
  if (!teacherId) return false
  return parseProjectAdminIds().has(teacherId)
}

