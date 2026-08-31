import { db } from "@/lib/db"
import {
  hasProjectCategoryAccessTargets,
  normalizeProjectCategoryAccessPolicy,
  type ProjectCategoryAccessPolicy,
} from "@/lib/project-category-access"
import { normalizeProjectCountryList, normalizeProjectUuidList } from "@/lib/projects"

export function normalizeProjectCategoryAccessBody(body: any): ProjectCategoryAccessPolicy {
  const policy = normalizeProjectCategoryAccessPolicy({
    access_scope: body?.access_scope === "targeted" ? "targeted" : "all",
    target_teacher_ids: normalizeProjectUuidList(body?.target_teacher_ids),
    target_countries: normalizeProjectCountryList(body?.target_countries),
    target_locales: Array.isArray(body?.target_locales) ? body.target_locales : [],
  })
  if (policy.access_scope === "all") {
    return { ...policy, target_teacher_ids: [], target_countries: [], target_locales: [] }
  }
  return policy
}

export function validateProjectCategoryAccessPolicy(policy: ProjectCategoryAccessPolicy) {
  if (policy.access_scope === "targeted" && !hasProjectCategoryAccessTargets(policy)) {
    return "Selecione ao menos um professor, país ou idioma para restringir a categoria."
  }
  return null
}

export async function validateProjectCategoryTeachers(policy: ProjectCategoryAccessPolicy) {
  if (policy.access_scope !== "targeted" || policy.target_teacher_ids.length === 0) return null

  const rows = await db`
    SELECT id::text AS id
    FROM public.teachers
    WHERE id = ANY(${policy.target_teacher_ids}::uuid[])
      AND active = TRUE
      AND approved = TRUE
  `
  if (rows.length !== policy.target_teacher_ids.length) {
    return "Um ou mais professores selecionados não estão ativos ou não existem."
  }
  return null
}
