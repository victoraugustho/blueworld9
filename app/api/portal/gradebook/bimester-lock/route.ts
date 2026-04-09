import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  getBimesterLock,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
} from "@/lib/gradebook"

async function loadOwnedClass(teacherId: string, classId: string) {
  const [row] = await db`
    SELECT *
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
  const bimester = normalizeBimester(search.get("bimester"))
  const schoolYear = normalizeSchoolYear(search.get("schoolYear"))

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }
  if (bimester === null) {
    return NextResponse.json({ error: "Bimestre invalido" }, { status: 400 })
  }
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  const classRow = await loadOwnedClass(auth.teacherId, classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const lock = await getBimesterLock(classId, schoolYear, bimester)
  return NextResponse.json({
    closed: !!lock,
    lock,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const body = await req.json().catch(() => ({}))
  const classId = String(body.class_id ?? "").trim()
  const bimester = normalizeBimester(body.bimester)
  const schoolYear = normalizeSchoolYear(body.school_year)

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }
  if (bimester === null) {
    return NextResponse.json({ error: "Bimestre invalido" }, { status: 400 })
  }
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  const classRow = await loadOwnedClass(auth.teacherId, classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const existing = await getBimesterLock(classId, schoolYear, bimester)
  if (existing) {
    return NextResponse.json({
      ok: true,
      closed: true,
      already_closed: true,
      lock: existing,
    })
  }

  const missingFinalRows = await db`
    WITH lesson_scope AS (
      SELECT l.id
      FROM teacher_grade_lessons l
      WHERE l.class_id = ${classId}
        AND l.school_year = ${schoolYear}
        AND l.bimester = ${bimester}
    ),
    lesson_metrics AS (
      SELECT
        e.student_id,
        ROUND(
          AVG((e.c1 + e.c2 + e.c3 + e.c4) / 4.0)
          FILTER (
            WHERE e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL
          )::numeric,
          2
        ) AS note1
      FROM teacher_grade_entries e
      JOIN lesson_scope ls
        ON ls.id = e.lesson_id
      GROUP BY e.student_id
    ),
    base AS (
      SELECT
        s.id AS student_id,
        s.full_name,
        lm.note1,
        bg.exam_score,
        bg.c5_score,
        bg.manual_final_score
      FROM teacher_class_students s
      LEFT JOIN lesson_metrics lm
        ON lm.student_id = s.id
      LEFT JOIN teacher_bimester_grades bg
        ON bg.class_id = ${classId}
       AND bg.student_id = s.id
       AND bg.school_year = ${schoolYear}
       AND bg.bimester = ${bimester}
      WHERE s.class_id = ${classId}
        AND s.active = TRUE
    ),
    final_calc AS (
      SELECT
        b.student_id,
        b.full_name,
        CASE
          WHEN b.manual_final_score IS NOT NULL THEN b.manual_final_score
          WHEN b.note1 IS NOT NULL
            AND (
              (b.exam_score IS NOT NULL AND b.c5_score IS NOT NULL)
              OR (b.exam_score IS NULL AND b.c5_score IS NOT NULL)
            )
            THEN ROUND(
              (
                b.note1 + (
                  CASE
                    WHEN b.exam_score IS NOT NULL
                      THEN ((b.exam_score + b.c5_score) / 2.0)
                    ELSE b.c5_score
                  END
                )
              ) / 2.0
            , 2)
          ELSE NULL
        END AS final_grade
      FROM base b
    )
    SELECT
      student_id,
      full_name
    FROM final_calc
    WHERE final_grade IS NULL
    ORDER BY full_name ASC
  `

  if (missingFinalRows.length > 0) {
    const previewNames = missingFinalRows
      .slice(0, 5)
      .map((row) => String(row.full_name ?? "").trim())
      .filter(Boolean)
    const moreCount = Math.max(0, missingFinalRows.length - previewNames.length)
    const namesPart =
      previewNames.length > 0
        ? ` Pendentes: ${previewNames.join(", ")}${moreCount > 0 ? ` e mais ${moreCount}.` : "."}`
        : ""

    return NextResponse.json(
      {
        error: `Nao e possivel fechar: existem ${missingFinalRows.length} aluno(s) sem nota final lancada.${namesPart}`,
        missing_final_count: missingFinalRows.length,
        missing_final_students: missingFinalRows,
      },
      { status: 400 },
    )
  }

  const [created] = await db`
    INSERT INTO teacher_gradebook_bimester_locks (
      class_id,
      school_year,
      bimester,
      locked_by_teacher_id,
      locked_at
    )
    VALUES (
      ${classId},
      ${schoolYear},
      ${bimester},
      ${auth.teacherId},
      NOW()
    )
    ON CONFLICT (class_id, school_year, bimester)
    DO NOTHING
    RETURNING *
  `

  const lock = created ?? (await getBimesterLock(classId, schoolYear, bimester))

  return NextResponse.json({
    ok: true,
    closed: true,
    already_closed: !created,
    lock,
  })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const body = await req.json().catch(() => ({}))
  const classId = String(body.class_id ?? "").trim()
  const bimester = normalizeBimester(body.bimester)
  const schoolYear = normalizeSchoolYear(body.school_year)

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }
  if (bimester === null) {
    return NextResponse.json({ error: "Bimestre invalido" }, { status: 400 })
  }
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  const classRow = await loadOwnedClass(auth.teacherId, classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const [removed] = await db`
    DELETE FROM teacher_gradebook_bimester_locks
    WHERE class_id = ${classId}
      AND school_year = ${schoolYear}
      AND bimester = ${bimester}
    RETURNING *
  `

  return NextResponse.json({
    ok: true,
    closed: false,
    already_open: !removed,
  })
}
