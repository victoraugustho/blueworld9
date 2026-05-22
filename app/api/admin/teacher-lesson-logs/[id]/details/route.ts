import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureGradebookSchema } from "@/lib/gradebook"

function inferBimesterFromDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const month = Number(match?.[2] ?? 0)
  if (month >= 1 && month <= 3) return 1
  if (month >= 4 && month <= 6) return 2
  if (month >= 7 && month <= 9) return 3
  return 4
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureGradebookSchema()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const teacherIdFilter = String(new URL(req.url).searchParams.get("teacherId") ?? "").trim()

  const [lessonLog] =
    teacherIdFilter
      ? await db`
          SELECT l.*, c.name AS class_name
          FROM teacher_lesson_logs l
          LEFT JOIN teacher_classes c
            ON c.id = l.class_id
          WHERE l.id = ${id}
            AND l.teacher_id = ${teacherIdFilter}
          LIMIT 1
        `
      : await db`
          SELECT l.*, c.name AS class_name
          FROM teacher_lesson_logs l
          LEFT JOIN teacher_classes c
            ON c.id = l.class_id
          WHERE l.id = ${id}
          LIMIT 1
        `

  if (!lessonLog) {
    return NextResponse.json({ error: "Registro de aula nao encontrado" }, { status: 404 })
  }

  let resolvedClassId = lessonLog.class_id ? String(lessonLog.class_id) : ""

  if (!resolvedClassId && lessonLog.schedule_id) {
    const [scheduleClass] = await db`
      SELECT class_id
      FROM teacher_schedules
      WHERE id = ${lessonLog.schedule_id}
        AND teacher_id = ${lessonLog.teacher_id}
      LIMIT 1
    `
    resolvedClassId = String(scheduleClass?.class_id ?? "").trim()
  }

  if (!resolvedClassId && lessonLog.class_label) {
    const classMatches = await db`
      SELECT id
      FROM teacher_classes
      WHERE teacher_id = ${lessonLog.teacher_id}
        AND lower(trim(name)) = lower(trim(${lessonLog.class_label}))
      ORDER BY school_year DESC, created_at DESC
      LIMIT 2
    `
    if (classMatches.length === 1) {
      resolvedClassId = String(classMatches[0]?.id ?? "").trim()
    }
  }

  const resolvedBimester = Number(lessonLog.bimester ?? inferBimesterFromDate(lessonLog.lesson_date))

  if (!resolvedClassId) {
    const classFromGrades = await db`
      SELECT class_id
      FROM teacher_grade_lessons
      WHERE teacher_id = ${lessonLog.teacher_id}
        AND lesson_number = ${lessonLog.lesson_number}
        AND bimester = ${resolvedBimester}
        AND (${String(lessonLog.lesson_date ?? "").trim()} = '' OR lesson_date = ${lessonLog.lesson_date}::date)
      GROUP BY class_id
      ORDER BY MAX(updated_at) DESC NULLS LAST, MAX(created_at) DESC
      LIMIT 2
    `
    if (classFromGrades.length === 1) {
      resolvedClassId = String(classFromGrades[0]?.class_id ?? "").trim()
    }
  }

  let gradeLesson: any = null
  if (resolvedClassId) {
    ;[gradeLesson] = await db`
      SELECT g.*, c.name AS class_name
      FROM teacher_grade_lessons g
      LEFT JOIN teacher_classes c
        ON c.id = g.class_id
      WHERE g.teacher_id = ${lessonLog.teacher_id}
        AND g.class_id = ${resolvedClassId}
        AND g.lesson_number = ${lessonLog.lesson_number}
        AND g.bimester = ${resolvedBimester}
      ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC
      LIMIT 1
    `
  }

  if (!gradeLesson && resolvedClassId && lessonLog.lesson_date) {
    ;[gradeLesson] = await db`
      SELECT g.*, c.name AS class_name
      FROM teacher_grade_lessons g
      LEFT JOIN teacher_classes c
        ON c.id = g.class_id
      WHERE g.teacher_id = ${lessonLog.teacher_id}
        AND g.class_id = ${resolvedClassId}
        AND g.lesson_date = ${lessonLog.lesson_date}::date
        AND g.bimester = ${resolvedBimester}
      ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC
      LIMIT 1
    `
  }

  const lessonDate = String(gradeLesson?.lesson_date ?? lessonLog.lesson_date ?? "").trim()
  const hasClass = Boolean(resolvedClassId)

  const entries = hasClass
    ? gradeLesson
      ? await db`
          SELECT
            s.id AS student_id,
            s.full_name,
            s.enrollment_code,
            s.active,
            CASE
              WHEN ${lessonDate} = '' THEN TRUE
              WHEN COALESCE(NULLIF(to_jsonb(s)->>'enrollment_at', '')::date, s.created_at::date) <= ${lessonDate}::date THEN TRUE
              ELSE FALSE
            END AS eligible_for_lesson,
            COALESCE(e.attendance, 'present') AS attendance,
            e.c1,
            e.c2,
            e.c3,
            e.c4,
            e.comment
          FROM teacher_class_students s
          LEFT JOIN teacher_grade_entries e
            ON e.student_id = s.id
           AND e.lesson_id = ${gradeLesson.id}
          WHERE s.class_id = ${resolvedClassId}
          ORDER BY s.full_name ASC
        `
      : await db`
          SELECT
            s.id AS student_id,
            s.full_name,
            s.enrollment_code,
            s.active,
            CASE
              WHEN ${lessonDate} = '' THEN TRUE
              WHEN COALESCE(NULLIF(to_jsonb(s)->>'enrollment_at', '')::date, s.created_at::date) <= ${lessonDate}::date THEN TRUE
              ELSE FALSE
            END AS eligible_for_lesson,
            NULL::text AS attendance,
            NULL::numeric AS c1,
            NULL::numeric AS c2,
            NULL::numeric AS c3,
            NULL::numeric AS c4,
            NULL::text AS comment
          FROM teacher_class_students s
          WHERE s.class_id = ${resolvedClassId}
          ORDER BY s.full_name ASC
        `
    : []

  return NextResponse.json({
    lesson_log: lessonLog,
    grade_lesson: gradeLesson,
    resolved_class_id: resolvedClassId || null,
    entries,
  })
}
