import { db } from "@/lib/db"
import { canTeacherAccessProjectWithCategory } from "@/lib/project-category-access"
import {
  canTeacherAccessProject,
  ensureProjectsSchema,
  isProjectCategoryAccessReady,
  loadTeacherScopeData,
} from "@/lib/projects"

export async function ensurePublishedProjectAccess(
  projectId: string,
  teacher: {
    id: string
    country?: string | null
    locale?: string | null
  },
) {
  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()
  const categoryAccessSelect = categoryAccessReady
    ? db`
        category.access_scope AS category_access_scope,
        category.target_teacher_ids AS category_target_teacher_ids,
        category.target_countries AS category_target_countries,
        category.target_locales AS category_target_locales
      `
    : db`
        'all'::text AS category_access_scope,
        ARRAY[]::uuid[] AS category_target_teacher_ids,
        ARRAY[]::text[] AS category_target_countries,
        ARRAY[]::text[] AS category_target_locales
      `

  let project: any = null
  try {
    ;[project] = await db`
      SELECT
        p.*,
        ${categoryAccessSelect}
      FROM public.teacher_projects p
      LEFT JOIN public.teacher_project_categories category
        ON category.id = p.category_id
        AND category.status = 'active'
        AND category.deleted_at IS NULL
      WHERE p.id = ${projectId}
        AND p.deleted_at IS NULL
        AND p.status = 'published'
      LIMIT 1
    `
  } catch (error) {
    if (categoryAccessReady) throw error
    ;[project] = await db`
      SELECT
        p.*,
        'all'::text AS category_access_scope,
        ARRAY[]::uuid[] AS category_target_teacher_ids,
        ARRAY[]::text[] AS category_target_countries,
        ARRAY[]::text[] AS category_target_locales
      FROM public.teacher_projects p
      WHERE p.id = ${projectId}
        AND p.deleted_at IS NULL
        AND p.status = 'published'
      LIMIT 1
    `
  }
  if (!project) return { ok: false as const, code: 404 as const }

  const scope = await loadTeacherScopeData(teacher.id)
  const canAccess = canTeacherAccessProjectWithCategory(
    project as any,
    {
      access_scope: project.category_access_scope,
      target_teacher_ids: project.category_target_teacher_ids,
      target_countries: project.category_target_countries,
      target_locales: project.category_target_locales,
    },
    {
      id: teacher.id,
      country: teacher.country,
      locale: teacher.locale,
      years: scope.years,
      classIds: scope.classIds,
    },
    canTeacherAccessProject,
  )

  if (!canAccess) return { ok: false as const, code: 403 as const }
  return { ok: true as const, project }
}
