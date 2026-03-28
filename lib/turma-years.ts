export type TurmaYearGroup = "age" | "grade" | "high"

export type TurmaYearOption = {
  value: number
  group: TurmaYearGroup
  label: string
}

export const TURMA_YEAR_OPTIONS: TurmaYearOption[] = [
  { value: 103, group: "age", label: "3 anos" },
  { value: 104, group: "age", label: "4 anos" },
  { value: 105, group: "age", label: "5 anos" },
  { value: 1, group: "grade", label: "Ano 1" },
  { value: 2, group: "grade", label: "Ano 2" },
  { value: 3, group: "grade", label: "Ano 3" },
  { value: 4, group: "grade", label: "Ano 4" },
  { value: 5, group: "grade", label: "Ano 5" },
  { value: 6, group: "grade", label: "Ano 6" },
  { value: 7, group: "grade", label: "Ano 7" },
  { value: 8, group: "grade", label: "Ano 8" },
  { value: 9, group: "grade", label: "Ano 9" },
  { value: 201, group: "high", label: "Ensino Medio 1" },
  { value: 202, group: "high", label: "Ensino Medio 2" },
  { value: 203, group: "high", label: "Ensino Medio 3" },
]

const TURMA_YEAR_SET = new Set(TURMA_YEAR_OPTIONS.map((item) => item.value))

export function isValidStudentYear(value: number) {
  return Number.isInteger(value) && TURMA_YEAR_SET.has(value)
}

export function getTurmaYearLabel(value: number) {
  return TURMA_YEAR_OPTIONS.find((item) => item.value === value)?.label ?? `Turma ${value}`
}
