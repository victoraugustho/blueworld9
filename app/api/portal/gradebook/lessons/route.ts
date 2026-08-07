import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { getDefaultTimezone } from "@/lib/timezones"
import {
  ensureGradebookSchema,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
  validateBimesterLaunchFlow,
} from "@/lib/gradebook"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getTodayInTimeZone(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  }
}

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

// Legacy gradebook reconciliation was intentionally removed from runtime GET flows.
// Use explicit SQL scripts for controlled reconciliation/recovery.

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const searchParams = new URL(req.url).searchParams
  const classId = String(searchParams.get("classId") ?? "").trim()
  const bimester = normalizeBimester(searchParams.get("bimester"))
  const schoolYear = normalizeSchoolYear(searchParams.get("schoolYear"))

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

  // Safety hardening:
  // keep GET as a pure read path. Legacy reconciliation must be explicit and controlled.

  const rows = await db`
    WITH lesson_students AS (
      SELECT
        l.id AS lesson_id,
        s.id AS student_id
      FROM teacher_grade_lessons l
      LEFT JOIN teacher_class_students s
        ON s.class_id = l.class_id
       AND s.active = TRUE
       AND COALESCE(s.enrollment_at, s.created_at::date) <= l.lesson_date::date
      WHERE l.teacher_id = ${auth.teacherId}
        AND l.class_id = ${classId}
        AND l.school_year = ${schoolYear}
        AND l.bimester = ${bimester}
    ),
    lesson_active_totals AS (
      SELECT
        l.id AS lesson_id,
        COUNT(s.id)::int AS total_active_students
      FROM teacher_grade_lessons l
      LEFT JOIN teacher_class_students s
        ON s.class_id = l.class_id
       AND s.active = TRUE
      WHERE l.teacher_id = ${auth.teacherId}
        AND l.class_id = ${classId}
        AND l.school_year = ${schoolYear}
        AND l.bimester = ${bimester}
      GROUP BY l.id
    )
    SELECT
      l.*,
      COUNT(e.student_id)::int AS entries_count,
      CASE
        WHEN COALESCE(l.has_grades, TRUE) = FALSE THEN 0
        ELSE COUNT(*) FILTER (
          WHERE e.c1 IS NOT NULL
            AND e.c2 IS NOT NULL
            AND e.c3 IS NOT NULL
            AND e.c4 IS NOT NULL
        )::int
      END AS graded_entries_count,
      COUNT(ls.student_id)::int AS total_students,
      COALESCE(MAX(lat.total_active_students), 0)::int AS total_active_students,
      GREATEST(COALESCE(MAX(lat.total_active_students), 0)::int - COUNT(ls.student_id)::int, 0)::int AS non_eligible_students,
      CASE
        WHEN COALESCE(l.has_grades, TRUE) = FALSE THEN 100
        WHEN COUNT(ls.student_id) > 0
          THEN ROUND(
            (
              COUNT(*) FILTER (
                WHERE e.attendance = 'absent'
                   OR (e.c1 IS NOT NULL
                  AND e.c2 IS NOT NULL
                  AND e.c3 IS NOT NULL
                  AND e.c4 IS NOT NULL)
              )::numeric / COUNT(ls.student_id)::numeric
            ) * 100.0
          , 2)
        ELSE 0
      END AS completion_percent,
      CASE
        WHEN COALESCE(l.has_grades, TRUE) = FALSE THEN TRUE
        WHEN COUNT(ls.student_id) > 0
          THEN COUNT(*) FILTER (
            WHERE e.attendance = 'absent'
               OR (e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL)
          ) >= COUNT(ls.student_id)
        ELSE FALSE
      END AS fully_launched,
      CASE
        WHEN COALESCE(l.has_grades, TRUE) = FALSE THEN 0
        ELSE COUNT(*) FILTER (WHERE e.attendance = 'absent')::int
      END AS absences_count
    FROM teacher_grade_lessons l
    LEFT JOIN lesson_students ls
      ON ls.lesson_id = l.id
    LEFT JOIN lesson_active_totals lat
      ON lat.lesson_id = l.id
    LEFT JOIN teacher_grade_entries e
      ON e.lesson_id = l.id
     AND e.student_id = ls.student_id
    WHERE l.teacher_id = ${auth.teacherId}
      AND l.class_id = ${classId}
      AND l.school_year = ${schoolYear}
      AND l.bimester = ${bimester}
    GROUP BY l.id
    ORDER BY l.lesson_number DESC, l.lesson_date DESC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const body = await req.json().catch(() => ({}))
  const classId = String(body.class_id ?? "").trim()
  const bimester = normalizeBimester(body.bimester)
  const schoolYear = normalizeSchoolYear(body.school_year)
  const notes = typeof body.notes === "string" ? body.notes.trim() : ""
  const hasGrades = body.has_grades === false ? false : true
  const dateRaw = String(body.lesson_date ?? "").trim()

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

  const flowValidation = await validateBimesterLaunchFlow(classId, schoolYear, bimester)
  if (!flowValidation.ok) {
    if (flowValidation.reason === "target_closed") {
      return NextResponse.json(
        {
          error: "Este bimestre esta fechado e nao permite novos lancamentos.",
          code: "BIMESTER_CLOSED",
          target_bimester: bimester,
        },
        { status: 409 },
      )
    }

    return NextResponse.json(
      {
        error: `Para lancar no B${bimester}, feche antes o(s) bimestre(s): ${flowValidation.missingPrevious.join(", ")}.`,
        code: "PREVIOUS_BIMESTER_NOT_CLOSED",
        target_bimester: bimester,
        missing_previous_bimesters: flowValidation.missingPrevious,
      },
      { status: 409 },
    )
  }

  let lessonDate = dateRaw
  if (lessonDate) {
    if (!isValidDate(lessonDate)) {
      return NextResponse.json({ error: "Data invalida" }, { status: 400 })
    }
  } else {
    lessonDate = getTodayInTimeZone(getDefaultTimezone(auth.teacher.country))
  }

  let created: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    const [last] = await sql`
      SELECT lesson_number
      FROM teacher_grade_lessons
      WHERE class_id = ${classId}
        AND school_year = ${schoolYear}
        AND bimester = ${bimester}
      ORDER BY lesson_number DESC
      LIMIT 1
      FOR UPDATE
    `

    const nextNumber = Number(last?.lesson_number ?? 0) + 1

    const [lesson] = await sql`
      INSERT INTO teacher_grade_lessons (
        teacher_id,
        class_id,
        school_year,
        bimester,
        lesson_number,
        lesson_date,
        has_grades,
        notes
      )
      VALUES (
        ${auth.teacherId},
        ${classId},
        ${schoolYear},
        ${bimester},
        ${nextNumber},
        ${lessonDate},
        ${hasGrades},
        ${notes || null}
      )
      RETURNING *
    `

    if (hasGrades) {
      await sql`
        INSERT INTO teacher_grade_entries (lesson_id, student_id, attendance)
        SELECT ${lesson.id}::uuid, s.id, 'present'
        FROM teacher_class_students s
        WHERE s.class_id = ${classId}
          AND s.active = TRUE
          AND COALESCE(s.enrollment_at, s.created_at::date) <= ${lessonDate}::date
        ON CONFLICT (lesson_id, student_id) DO NOTHING
      `
    }

    created = lesson
  })

  return NextResponse.json(created)
}
