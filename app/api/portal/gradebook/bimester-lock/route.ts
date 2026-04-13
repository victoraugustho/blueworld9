import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  getBimesterLock,
  getScoreMaxByCountry,
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

async function loadClass(classId: string) {
  const [row] = await db`
    SELECT
      tc.*,
      t.country AS teacher_country
    FROM teacher_classes tc
    LEFT JOIN teachers t
      ON t.id = tc.teacher_id
    WHERE tc.id = ${classId}
    LIMIT 1
  `
  return row
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

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

  const classRow = isAdmin
    ? await loadClass(classId)
    : await loadOwnedClass(auth.teacherId, classId)
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
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode fechar bimestre." }, { status: 403 })
  }

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

  const classRow = await loadClass(classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }
  const isPyScoreScale = getScoreMaxByCountry(classRow.teacher_country ?? auth.teacher.country) <= 5

  const existing = await getBimesterLock(classId, schoolYear, bimester)
  if (existing) {
    return NextResponse.json({
      ok: true,
      closed: true,
      already_closed: true,
      lock: existing,
    })
  }

  const [lessonScopeSummary] = await db`
    SELECT COUNT(*)::int AS lesson_count
    FROM teacher_grade_lessons
    WHERE class_id = ${classId}
      AND school_year = ${schoolYear}
      AND bimester = ${bimester}
  `

  if (Number(lessonScopeSummary?.lesson_count ?? 0) <= 0) {
    return NextResponse.json(
      { error: "Nao e possivel fechar: nao existem aulas lancadas neste bimestre." },
      { status: 400 },
    )
  }

  const missingLessonRows = await db`
    WITH lesson_scope AS (
      SELECT l.id
      FROM teacher_grade_lessons l
      WHERE l.class_id = ${classId}
        AND l.school_year = ${schoolYear}
        AND l.bimester = ${bimester}
    ),
    active_students AS (
      SELECT s.id, s.full_name
      FROM teacher_class_students s
      WHERE s.class_id = ${classId}
        AND s.active = TRUE
    )
    SELECT
      s.id AS student_id,
      s.full_name,
      COUNT(*) FILTER (
        WHERE e.lesson_id IS NULL
           OR e.attendance IS NULL
           OR e.c1 IS NULL
           OR e.c2 IS NULL
           OR e.c3 IS NULL
           OR e.c4 IS NULL
      )::int AS pending_lessons
    FROM active_students s
    CROSS JOIN lesson_scope l
    LEFT JOIN teacher_grade_entries e
      ON e.lesson_id = l.id
     AND e.student_id = s.id
    GROUP BY s.id, s.full_name
    HAVING COUNT(*) FILTER (
      WHERE e.lesson_id IS NULL
         OR e.attendance IS NULL
         OR e.c1 IS NULL
         OR e.c2 IS NULL
         OR e.c3 IS NULL
         OR e.c4 IS NULL
    ) > 0
    ORDER BY s.full_name ASC
  `

  if (missingLessonRows.length > 0) {
    const previewNames = missingLessonRows
      .slice(0, 5)
      .map((row) => String(row.full_name ?? "").trim())
      .filter(Boolean)
    const moreCount = Math.max(0, missingLessonRows.length - previewNames.length)
    const namesPart =
      previewNames.length > 0
        ? ` Pendentes: ${previewNames.join(", ")}${moreCount > 0 ? ` e mais ${moreCount}.` : "."}`
        : ""

    return NextResponse.json(
      {
        error: `Nao e possivel fechar: existem ${missingLessonRows.length} aluno(s) com notas/presenca pendentes nas aulas.${namesPart}`,
        missing_lesson_count: missingLessonRows.length,
        missing_lesson_students: missingLessonRows,
      },
      { status: 400 },
    )
  }

  const missingNote2Rows = await db`
    SELECT
      s.id AS student_id,
      s.full_name
    FROM teacher_class_students s
    LEFT JOIN teacher_bimester_grades bg
      ON bg.class_id = ${classId}
     AND bg.student_id = s.id
     AND bg.school_year = ${schoolYear}
     AND bg.bimester = ${bimester}
    WHERE s.class_id = ${classId}
      AND s.active = TRUE
      AND (
        bg.exam_score IS NULL
        OR bg.c5_score IS NULL
      )
    ORDER BY s.full_name ASC
  `

  if (missingNote2Rows.length > 0) {
    const previewNames = missingNote2Rows
      .slice(0, 5)
      .map((row) => String(row.full_name ?? "").trim())
      .filter(Boolean)
    const moreCount = Math.max(0, missingNote2Rows.length - previewNames.length)
    const namesPart =
      previewNames.length > 0
        ? ` Pendentes: ${previewNames.join(", ")}${moreCount > 0 ? ` e mais ${moreCount}.` : "."}`
        : ""

    return NextResponse.json(
      {
        error: `Nao e possivel fechar: existem ${missingNote2Rows.length} aluno(s) sem Prova/Atividade e/ou C5 lancados.${namesPart}`,
        missing_note2_count: missingNote2Rows.length,
        missing_note2_students: missingNote2Rows,
      },
      { status: 400 },
    )
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
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas admin pode reabrir bimestre." }, { status: 403 })
  }

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

  const classRow = await loadClass(classId)
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
