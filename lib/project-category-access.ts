export const PROJECT_CATEGORY_ACCESS_SCOPES = ["all", "targeted"] as const
export const PROJECT_CATEGORY_ACCESS_LOCALES = ["pt-BR", "es"] as const
export const PROJECT_CATEGORY_ACCESS_COUNTRIES = ["BR", "UY", "PY"] as const

export type ProjectCategoryAccessScope = (typeof PROJECT_CATEGORY_ACCESS_SCOPES)[number]
export type ProjectCategoryAccessLocale = (typeof PROJECT_CATEGORY_ACCESS_LOCALES)[number]
export type ProjectCategoryAccessCountry = (typeof PROJECT_CATEGORY_ACCESS_COUNTRIES)[number]

export type ProjectCategoryAccessPolicy = {
  access_scope: ProjectCategoryAccessScope
  target_teacher_ids: string[]
  target_countries: ProjectCategoryAccessCountry[]
  target_locales: ProjectCategoryAccessLocale[]
}

export type ProjectCategoryAccessTeacher = {
  id: string
  country?: string | null
  locale?: string | null
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  )
}

export function normalizeProjectCategoryAccessPolicy(
  value: Partial<ProjectCategoryAccessPolicy> | null | undefined,
): ProjectCategoryAccessPolicy {
  const access_scope = value?.access_scope === "targeted" ? "targeted" : "all"
  const target_teacher_ids = uniqueStrings(value?.target_teacher_ids)
  const target_countries = uniqueStrings(value?.target_countries).filter(
    (item): item is ProjectCategoryAccessCountry =>
      (PROJECT_CATEGORY_ACCESS_COUNTRIES as readonly string[]).includes(item),
  )
  const target_locales = uniqueStrings(value?.target_locales).filter(
    (item): item is ProjectCategoryAccessLocale =>
      (PROJECT_CATEGORY_ACCESS_LOCALES as readonly string[]).includes(item),
  )

  return {
    access_scope,
    target_teacher_ids,
    target_countries,
    target_locales,
  }
}

export function hasProjectCategoryAccessTargets(policy: ProjectCategoryAccessPolicy) {
  return (
    policy.target_teacher_ids.length > 0 ||
    policy.target_countries.length > 0 ||
    policy.target_locales.length > 0
  )
}

export function canTeacherAccessProjectCategory(
  category: Partial<ProjectCategoryAccessPolicy> | null | undefined,
  teacher: ProjectCategoryAccessTeacher,
) {
  const policy = normalizeProjectCategoryAccessPolicy(category)
  if (policy.access_scope === "all") return true

  // Category rules are deliberately combined with OR ("qualquer uma").
  if (policy.target_teacher_ids.includes(teacher.id)) return true
  if (teacher.country && policy.target_countries.includes(teacher.country as ProjectCategoryAccessCountry)) {
    return true
  }
  if (teacher.locale && policy.target_locales.includes(teacher.locale as ProjectCategoryAccessLocale)) {
    return true
  }

  return false
}

export function canTeacherAccessProjectWithCategory(
  project: {
    access_scope: string
    target_teacher_ids?: string[] | null
    target_countries?: string[] | null
    target_student_years?: number[] | null
    target_class_ids?: string[] | null
  },
  category: Partial<ProjectCategoryAccessPolicy> | null | undefined,
  teacher: ProjectCategoryAccessTeacher & {
    years: number[]
    classIds: string[]
  },
  canAccessTargetedProject: (
    project: {
      access_scope: string
      target_teacher_ids?: string[] | null
      target_countries?: string[] | null
      target_student_years?: number[] | null
      target_class_ids?: string[] | null
    },
    teacher: {
      teacherId: string
      teacherCountry: string | null
      teacherYears: number[]
      teacherClassIds: string[]
    },
  ) => boolean,
) {
  if (project.access_scope === "targeted") {
    return canAccessTargetedProject(project, {
      teacherId: teacher.id,
      teacherCountry: teacher.country ? String(teacher.country) : null,
      teacherYears: teacher.years,
      teacherClassIds: teacher.classIds,
    })
  }

  return canTeacherAccessProjectCategory(category, teacher)
}
