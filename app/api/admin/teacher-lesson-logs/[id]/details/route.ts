import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureGradebookSchema } from "@/lib/gradebook"

function inferredBimesterSql() {
  return db`
    CASE
      WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
      WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
      WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
      ELSE 4
    END
  `
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

  let gradeLesson: any = null
  if (lessonLog.class_id) {
    ;[gradeLesson] = await db`
      SELECT g.*, c.name AS class_name
      FROM teacher_grade_lessons g
      LEFT JOIN teacher_classes c
        ON c.id = g.class_id
      WHERE g.teacher_id = ${lessonLog.teacher_id}
        AND g.class_id = ${lessonLog.class_id}
        AND g.lesson_number = ${lessonLog.lesson_number}
        AND g.bimester = COALESCE(
          ${lessonLog.bimester}::int,
          ${inferredBimesterSql()}
        )
      ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC
      LIMIT 1
    `
  }

  if (!gradeLesson && lessonLog.class_id && lessonLog.lesson_date) {
    ;[gradeLesson] = await db`
      SELECT g.*, c.name AS class_name
      FROM teacher_grade_lessons g
      LEFT JOIN teacher_classes c
        ON c.id = g.class_id
      WHERE g.teacher_id = ${lessonLog.teacher_id}
        AND g.class_id = ${lessonLog.class_id}
        AND g.lesson_date = ${lessonLog.lesson_date}::date
        AND g.bimester = COALESCE(
          ${lessonLog.bimester}::int,
          ${inferredBimesterSql()}
        )
      ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC
      LIMIT 1
    `
  }

  const lessonDate = String(gradeLesson?.lesson_date ?? lessonLog.lesson_date ?? "").trim()
  const hasClass = Boolean(lessonLog.class_id)

  const entries = hasClass
    ? gradeLesson
      ? await db`
          SELECT
            s.id AS student_id,
            s.full_name,
            s.enrollment_code,
            s.active,
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
          WHERE s.class_id = ${lessonLog.class_id}
            AND (${lessonDate} = '' OR s.created_at::date <= ${lessonDate}::date)
          ORDER BY s.full_name ASC
        `
      : await db`
          SELECT
            s.id AS student_id,
            s.full_name,
            s.enrollment_code,
            s.active,
            NULL::text AS attendance,
            NULL::numeric AS c1,
            NULL::numeric AS c2,
            NULL::numeric AS c3,
            NULL::numeric AS c4,
            NULL::text AS comment
          FROM teacher_class_students s
          WHERE s.class_id = ${lessonLog.class_id}
            AND (${lessonDate} = '' OR s.created_at::date <= ${lessonDate}::date)
          ORDER BY s.full_name ASC
        `
    : []

  return NextResponse.json({
    lesson_log: lessonLog,
    grade_lesson: gradeLesson,
    entries,
  })
}

