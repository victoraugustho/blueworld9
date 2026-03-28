import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth/require"
import { db } from "@/lib/db"
import { ensureTurmasSchema, TURMA_YEAR_OPTIONS, getTurmaYearLabel } from "@/lib/turmas"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const years = TURMA_YEAR_OPTIONS.map((item) => item.value)

  const rows = await db`
    SELECT
      y.student_year::int AS student_year,
      COUNT(DISTINCT tys.teacher_id)::int AS teacher_count,
      COUNT(DISTINCT m.id)::int AS material_count
    FROM UNNEST(${years}::smallint[]) AS y(student_year)
    LEFT JOIN teacher_student_years tys
      ON tys.student_year = y.student_year
    LEFT JOIN materials m
      ON m.student_year = y.student_year
    GROUP BY y.student_year
    ORDER BY y.student_year ASC
  `

  const map = new Map<number, { teacher_count: number; material_count: number }>()
  for (const row of rows as any[]) {
    map.set(Number(row.student_year), {
      teacher_count: Number(row.teacher_count ?? 0),
      material_count: Number(row.material_count ?? 0),
    })
  }

  const response = TURMA_YEAR_OPTIONS.map((item) => {
    const fromDb = map.get(item.value)
    return {
      student_year: item.value,
      label: item.label,
      group: item.group,
      teacher_count: fromDb?.teacher_count ?? 0,
      material_count: fromDb?.material_count ?? 0,
      group_label:
        item.group === "age"
          ? "Idade"
          : item.group === "high"
            ? "Ensino Medio"
            : "Ano",
      fallback_label: getTurmaYearLabel(item.value),
    }
  })

  return NextResponse.json(response)
}
