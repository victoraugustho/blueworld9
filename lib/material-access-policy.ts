export type MaterialAccessMode = "all" | "dynamic" | "specific"
export type MaterialAccessMatchStrategy = "all" | "any"
export type MaterialAccessLocale = "pt-BR" | "es"
export type MaterialAccessCountry = "BR" | "UY" | "PY"

export type MaterialAccessPolicyV2 = {
  version: 2
  mode: MaterialAccessMode
  match_strategy: MaterialAccessMatchStrategy
  locales: MaterialAccessLocale[]
  countries: MaterialAccessCountry[]
  student_years: number[]
  category_ids: number[]
  include_teacher_ids: string[]
  exclude_teacher_ids: string[]
}

export type MaterialAccessTeacher = {
  id: string
  name?: string
  email?: string
  locale?: string | null
  country?: string | null
  student_years?: number[] | null
  category_ids?: number[] | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VALID_YEARS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 103, 104, 105, 201, 202, 203])

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)))
}

function uniqueNumbers(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item)),
    ),
  )
}

export function createDefaultMaterialAccessPolicy(language: MaterialAccessLocale): MaterialAccessPolicyV2 {
  return {
    version: 2,
    mode: "dynamic",
    match_strategy: "all",
    locales: [language],
    countries: [],
    student_years: [],
    category_ids: [],
    include_teacher_ids: [],
    exclude_teacher_ids: [],
  }
}

export function normalizeMaterialAccessPolicy(value: unknown): MaterialAccessPolicyV2 | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Política de acesso inválida")
  }

  const raw = value as Record<string, unknown>
  if (Number(raw.version) !== 2) {
    throw new Error("Versão da política de acesso não suportada")
  }

  const mode = raw.mode
  if (mode !== "all" && mode !== "dynamic" && mode !== "specific") {
    throw new Error("Modo de acesso inválido")
  }

  const matchStrategy = raw.match_strategy === "any" ? "any" : "all"
  const locales = uniqueStrings(raw.locales).filter(
    (item): item is MaterialAccessLocale => item === "pt-BR" || item === "es",
  )
  const countries = uniqueStrings(raw.countries).filter(
    (item): item is MaterialAccessCountry => item === "BR" || item === "UY" || item === "PY",
  )
  const studentYears = uniqueNumbers(raw.student_years).filter((item) => VALID_YEARS.has(item))
  const categoryIds = uniqueNumbers(raw.category_ids).filter((item) => item > 0)
  const includeTeacherIds = uniqueStrings(raw.include_teacher_ids).filter((item) => UUID_PATTERN.test(item))
  const excludeTeacherIds = uniqueStrings(raw.exclude_teacher_ids).filter((item) => UUID_PATTERN.test(item))

  const excluded = new Set(excludeTeacherIds)
  const cleanIncludes = includeTeacherIds.filter((id) => !excluded.has(id))

  if (
    mode === "dynamic" &&
    locales.length === 0 &&
    countries.length === 0 &&
    studentYears.length === 0 &&
    categoryIds.length === 0
  ) {
    throw new Error("Defina ao menos uma condição para o grupo dinâmico")
  }

  if (mode === "specific" && cleanIncludes.length === 0) {
    throw new Error("Selecione ao menos um professor para o acesso específico")
  }

  return {
    version: 2,
    mode,
    match_strategy: matchStrategy,
    locales,
    countries,
    student_years: studentYears,
    category_ids: categoryIds,
    include_teacher_ids: cleanIncludes,
    exclude_teacher_ids: excludeTeacherIds,
  }
}

export function evaluateMaterialAccessPolicy(
  policy: MaterialAccessPolicyV2,
  teacher: MaterialAccessTeacher,
) {
  if (policy.exclude_teacher_ids.includes(teacher.id)) {
    return { allowed: false, reason: "Excluído individualmente" }
  }

  if (policy.include_teacher_ids.includes(teacher.id)) {
    return { allowed: true, reason: "Incluído individualmente" }
  }

  if (policy.mode === "all") {
    return { allowed: true, reason: "Acesso geral" }
  }

  if (policy.mode === "specific") {
    return { allowed: false, reason: "Não está na lista específica" }
  }

  const teacherYears = new Set((teacher.student_years ?? []).map(Number))
  const teacherCategories = new Set((teacher.category_ids ?? []).map(Number))
  const checks: Array<{ selected: boolean; matches: boolean; label: string }> = [
    {
      selected: policy.locales.length > 0,
      matches: policy.locales.includes(teacher.locale as MaterialAccessLocale),
      label: "idioma",
    },
    {
      selected: policy.countries.length > 0,
      matches: policy.countries.includes(teacher.country as MaterialAccessCountry),
      label: "país",
    },
    {
      selected: policy.student_years.length > 0,
      matches: policy.student_years.some((year) => teacherYears.has(year)),
      label: "ano/turma",
    },
    {
      selected: policy.category_ids.length > 0,
      matches: policy.category_ids.some((categoryId) => teacherCategories.has(categoryId)),
      label: "categoria",
    },
  ].filter((check) => check.selected)

  const allowed =
    policy.match_strategy === "all"
      ? checks.length > 0 && checks.every((check) => check.matches)
      : checks.some((check) => check.matches)
  const matchedLabels = checks.filter((check) => check.matches).map((check) => check.label)

  return {
    allowed,
    reason: allowed
      ? `Grupo dinâmico: ${matchedLabels.join(", ")}`
      : "Não atende às condições do grupo",
  }
}
