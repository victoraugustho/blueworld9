import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  getBimesterLock,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
} from "@/lib/gradebook"

async function loadOwnedClass(teacherId: string, classId: string) {
  const [row] = await db`
    SELECT
      tc.*,
      t.country AS teacher_country
    FROM teacher_classes tc
    LEFT JOIN teachers t
      ON t.id = tc.teacher_id
    WHERE tc.id = ${classId}
      AND tc.teacher_id = ${teacherId}
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
  const className = String(classRow.name ?? "")
  const isPyScoreScale = getScoreMaxByCountry(classRow.teacher_country ?? auth.teacher.country) <= 5

  await db`
    DELETE FROM teacher_grade_lessons gl
    WHERE gl.teacher_id = ${auth.teacherId}
      AND gl.class_id = ${classId}
      AND gl.school_year = ${schoolYear}
      AND gl.bimester = ${bimester}
      AND NOT EXISTS (
        SELECT 1
        FROM teacher_lesson_logs l
        WHERE l.teacher_id = ${auth.teacherId}
          AND (
            l.class_id = ${classId}
            OR (
              l.class_id IS NULL
              AND lower(trim(l.class_label)) = lower(trim(${className}))
            )
          )
          AND COALESCE(l.school_year::int, EXTRACT(YEAR FROM l.lesson_date)::int) = ${schoolYear}
          AND COALESCE(
            l.bimester::int,
            CASE
              WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 1 AND 3 THEN 1
              WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 4 AND 6 THEN 2
              WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 7 AND 9 THEN 3
              ELSE 4
            END
          ) = ${bimester}
          AND l.lesson_number = gl.lesson_number
      )
  `

  const lock = await getBimesterLock(classId, schoolYear, bimester)

  const rows = await db`
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
        COUNT(*) FILTER (
          WHERE e.c1 IS NOT NULL
            AND e.c2 IS NOT NULL
            AND e.c3 IS NOT NULL
            AND e.c4 IS NOT NULL
        )::int AS graded_lessons,
        ROUND(
          AVG((e.c1 + e.c2 + e.c3 + e.c4) / 4.0)
          FILTER (
            WHERE e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL
          )::numeric,
          2
        ) AS note1,
        COUNT(*) FILTER (WHERE e.attendance = 'present')::int AS presence_count,
        COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absence_count
      FROM teacher_grade_entries e
      JOIN lesson_scope ls
        ON ls.id = e.lesson_id
      GROUP BY e.student_id
    ),
    base AS (
      SELECT
        s.id AS student_id,
        s.full_name,
        COALESCE(lm.graded_lessons, 0)::int AS graded_lessons,
        lm.note1,
        COALESCE(lm.presence_count, 0)::int AS presence_count,
        COALESCE(lm.absence_count, 0)::int AS absence_count,
        COALESCE(bg.has_exam, TRUE) AS has_exam,
        bg.exam_score,
        bg.c5_score,
        bg.manual_final_score,
        bg.notes AS bimester_notes
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
    )
    SELECT
      b.*,
      CASE
        WHEN b.exam_score IS NOT NULL
         AND b.c5_score IS NOT NULL
          THEN ROUND(
            (
              CASE
                WHEN ${isPyScoreScale}
                  THEN ((b.exam_score + b.c5_score) / 2.0)
                ELSE (b.exam_score + b.c5_score)
              END
            )::numeric,
            2
          )
        ELSE NULL
      END AS note2,
      CASE
        WHEN b.manual_final_score IS NOT NULL THEN b.manual_final_score
        WHEN b.note1 IS NOT NULL
         AND b.exam_score IS NOT NULL
         AND b.c5_score IS NOT NULL
          THEN ROUND(
            (
              b.note1 + (
                CASE
                  WHEN ${isPyScoreScale}
                    THEN ((b.exam_score + b.c5_score) / 2.0)
                  ELSE (b.exam_score + b.c5_score)
                END
              )
            ) / 2.0
          , 2)
        ELSE NULL
      END AS final_grade
    FROM base b
    ORDER BY b.full_name ASC
  `

  const [scopeRaw] = await db`
    SELECT
      ${classId}::uuid AS class_id,
      ${schoolYear}::int AS school_year,
      ${bimester}::int AS bimester,
      (SELECT COUNT(*)::int
       FROM teacher_grade_lessons
       WHERE class_id = ${classId}
         AND school_year = ${schoolYear}
         AND bimester = ${bimester}
      ) AS lesson_count
  `

  const scope = {
    ...scopeRaw,
    closed: !!lock,
    locked_at: lock?.locked_at ?? null,
    locked_by_teacher_id: lock?.locked_by_teacher_id ?? null,
  }

  return NextResponse.json({
    scope,
    students: rows,
  })
}
