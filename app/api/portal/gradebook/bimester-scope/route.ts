import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  isUuid,
  normalizeSchoolYear,
} from "@/lib/gradebook"

async function loadOwnedClass(teacherId: string, classId: string) {
  const [row] = await db`
    SELECT id
    FROM teacher_classes
    WHERE id = ${classId}
      AND teacher_id = ${teacherId}
    LIMIT 1
  `
  return row
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const search = new URL(req.url).searchParams
  const classId = String(search.get("classId") ?? "").trim()
  const schoolYear = normalizeSchoolYear(search.get("schoolYear"))

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  const classRow = await loadOwnedClass(auth.teacherId, classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const lockRows = await db`
    SELECT bimester
    FROM teacher_gradebook_bimester_locks
    WHERE class_id = ${classId}
      AND school_year = ${schoolYear}
  `

  const lockedBimesters = new Set(
    lockRows
      .map((item: any) => Number(item?.bimester))
      .filter((value: number) => Number.isFinite(value) && value >= 1 && value <= 4),
  )

  const recommendedBimester =
    ([1, 2, 3, 4] as const).find((value) => !lockedBimesters.has(value)) ?? 4

  return NextResponse.json({
    class_id: classId,
    school_year: schoolYear,
    recommended_bimester: recommendedBimester,
    bimesters: [1, 2, 3, 4].map((value) => ({
      bimester: value,
      closed: lockedBimesters.has(value),
    })),
  })
}
