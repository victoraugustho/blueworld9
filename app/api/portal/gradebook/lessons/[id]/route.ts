import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { getDefaultTimezone } from "@/lib/timezones"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  getBimesterLock,
  isUuid,
  normalizeAttendance,
  normalizeScore,
} from "@/lib/gradebook"

type Ctx = { params: Promise<{ id: string }> }

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

function normalizeDateInput(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  if (isValidDate(raw)) return raw

  const isoWithTime = raw.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (isoWithTime) return isoWithTime[1]

  return ""
}

async function loadOwnedLesson(teacherId: string, lessonId: string) {
  const [lesson] = await db`
    SELECT l.*, c.name AS class_name
    FROM teacher_grade_lessons l
    JOIN teacher_classes c ON c.id = l.class_id
    WHERE l.id = ${lessonId}
      AND l.teacher_id = ${teacherId}
    LIMIT 1
  `
  return lesson
}

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

async function loadLinkedLessonLog(params: {
  teacherId: string
  classId: string
  lessonNumber: number
  bimester: number
  lessonDate: string
}) {
  const { teacherId, classId, lessonNumber, bimester, lessonDate } = params

  const [byNumber] = await db`
    SELECT id, notes, observations, lesson_date
    FROM teacher_lesson_logs
    WHERE teacher_id = ${teacherId}
      AND class_id = ${classId}
      AND lesson_number = ${lessonNumber}
      AND COALESCE(bimester::int, ${inferredBimesterSql()}) = ${bimester}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `

  if (byNumber) return byNumber

  const normalizedDate = normalizeDateInput(lessonDate)
  if (!normalizedDate) return null

  const [byDate] = await db`
    SELECT id, notes, observations, lesson_date
    FROM teacher_lesson_logs
    WHERE teacher_id = ${teacherId}
      AND class_id = ${classId}
      AND lesson_date = ${normalizedDate}::date
      AND COALESCE(bimester::int, ${inferredBimesterSql()}) = ${bimester}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `

  return byDate ?? null
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const lessonId = String(resolved?.id ?? "").trim()
  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: "Aula invalida" }, { status: 400 })
  }

  const lesson = await loadOwnedLesson(auth.teacherId, lessonId)
  if (!lesson) {
    return NextResponse.json({ error: "Aula nao encontrada" }, { status: 404 })
  }

  const linkedLog = await loadLinkedLessonLog({
    teacherId: auth.teacherId,
    classId: String(lesson.class_id),
    lessonNumber: Number(lesson.lesson_number),
    bimester: Number(lesson.bimester),
    lessonDate: String(lesson.lesson_date ?? ""),
  })

  const entries = await db`
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
     AND e.lesson_id = ${lessonId}
    WHERE s.class_id = ${lesson.class_id}
      AND s.active = TRUE
      AND COALESCE(s.enrollment_at, s.created_at::date) <= ${lesson.lesson_date}::date
    ORDER BY s.full_name ASC
  `

  return NextResponse.json({
    lesson: {
      ...lesson,
      diary_notes: linkedLog?.notes ?? lesson.notes ?? null,
      observations: linkedLog?.observations ?? null,
      lesson_log_id: linkedLog?.id ?? null,
    },
    entries,
  })
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()
  const scoreMax = getScoreMaxByCountry(auth.teacher.country)

  const resolved = await ctx.params
  const lessonId = String(resolved?.id ?? "").trim()
  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: "Aula invalida" }, { status: 400 })
  }

  const lesson = await loadOwnedLesson(auth.teacherId, lessonId)
  if (!lesson) {
    return NextResponse.json({ error: "Aula nao encontrada" }, { status: 404 })
  }

  const lock = await getBimesterLock(
    String(lesson.class_id),
    Number(lesson.school_year),
    Number(lesson.bimester),
  )
  if (lock) {
    return NextResponse.json(
      { error: "Este bimestre esta fechado e nao permite alterar lancamentos." },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const linkedLog = await loadLinkedLessonLog({
    teacherId: auth.teacherId,
    classId: String(lesson.class_id),
    lessonNumber: Number(lesson.lesson_number),
    bimester: Number(lesson.bimester),
    lessonDate: String(lesson.lesson_date ?? ""),
  })

  const notes =
    typeof body.notes === "string"
      ? body.notes.trim()
      : String(linkedLog?.notes ?? lesson.notes ?? "")
  const hasGrades =
    body.has_grades === undefined ? lesson.has_grades !== false : body.has_grades === false ? false : true
  const observations =
    typeof body.observations === "string"
      ? body.observations.trim()
      : String(linkedLog?.observations ?? "")
  const rawLessonDateInput = body.lesson_date !== undefined ? String(body.lesson_date ?? "").trim() : ""
  const lessonDateFromPayload = normalizeDateInput(body.lesson_date)
  if (rawLessonDateInput && !lessonDateFromPayload) {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 })
  }

  const lessonDateFromExisting = normalizeDateInput(lesson.lesson_date)
  const lessonDateRaw =
    lessonDateFromPayload ||
    lessonDateFromExisting ||
    getTodayInTimeZone(getDefaultTimezone(auth.teacher.country))

  const entries = Array.isArray(body.entries) ? body.entries : []
  const studentIds = entries
     .map((item: any) => String(item?.student_id ?? "").trim())
     .filter((id: string) => isUuid(id))

  if (studentIds.length > 0) {
    const validStudents = await db`
      SELECT id
      FROM teacher_class_students
      WHERE class_id = ${lesson.class_id}
        AND COALESCE(enrollment_at, created_at::date) <= ${lessonDateRaw}::date
        AND id = ANY(${studentIds}::uuid[])
    `
    if (validStudents.length !== studentIds.length) {
      return NextResponse.json({ error: "Existe aluno invalido no lancamento" }, { status: 400 })
    }
  }

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    await sql`
      UPDATE teacher_grade_lessons
      SET
        lesson_date = ${lessonDateRaw},
        has_grades = ${hasGrades},
        notes = ${notes || null}
      WHERE id = ${lessonId}
    `

    if (linkedLog?.id) {
      await sql`
        UPDATE teacher_lesson_logs
        SET
          lesson_date = ${lessonDateRaw},
          has_grades = ${hasGrades},
          notes = ${notes || null},
          observations = ${observations || null},
          updated_at = NOW()
        WHERE id = ${linkedLog.id}
      `
    } else {
      await sql`
        WITH candidate AS (
          SELECT id
          FROM teacher_lesson_logs
          WHERE teacher_id = ${auth.teacherId}
            AND class_id = ${lesson.class_id}
            AND lesson_number = ${lesson.lesson_number}
            AND COALESCE(
              bimester::int,
              CASE
                WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
                WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
                WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
                ELSE 4
              END
            ) = ${lesson.bimester}
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        )
        UPDATE teacher_lesson_logs l
        SET
          lesson_date = ${lessonDateRaw},
          has_grades = ${hasGrades},
          notes = ${notes || null},
          observations = ${observations || null},
          updated_at = NOW()
        FROM candidate c
        WHERE l.id = c.id
      `
    }

    if (!hasGrades) {
      await sql`
        DELETE FROM teacher_grade_entries
        WHERE lesson_id = ${lessonId}
      `
    } else {
      for (const entry of entries) {
        const studentId = String(entry?.student_id ?? "").trim()
        if (!isUuid(studentId)) continue

        const attendance = normalizeAttendance(entry?.attendance)
        const isAbsent = attendance === "absent"
        // Absence and lesson scores are mutually exclusive. This server-side
        // rule also protects updates coming from older clients.
        const c1 = isAbsent ? null : normalizeScore(entry?.c1, scoreMax)
        const c2 = isAbsent ? null : normalizeScore(entry?.c2, scoreMax)
        const c3 = isAbsent ? null : normalizeScore(entry?.c3, scoreMax)
        const c4 = isAbsent ? null : normalizeScore(entry?.c4, scoreMax)
        const comment = typeof entry?.comment === "string" ? entry.comment.trim() : null

        await sql`
          INSERT INTO teacher_grade_entries (
            lesson_id,
            student_id,
            attendance,
            c1,
            c2,
            c3,
            c4,
            comment,
            updated_at
          )
          VALUES (
            ${lessonId},
            ${studentId},
            ${attendance},
            ${c1},
            ${c2},
            ${c3},
            ${c4},
            ${comment},
            NOW()
          )
          ON CONFLICT (lesson_id, student_id)
          DO UPDATE SET
            attendance = EXCLUDED.attendance,
            c1 = EXCLUDED.c1,
            c2 = EXCLUDED.c2,
            c3 = EXCLUDED.c3,
            c4 = EXCLUDED.c4,
            comment = EXCLUDED.comment,
            updated_at = NOW()
        `
      }

      await sql`
        INSERT INTO teacher_grade_entries (lesson_id, student_id, attendance)
        SELECT ${lessonId}::uuid, s.id, 'present'
        FROM teacher_class_students s
        WHERE s.class_id = ${lesson.class_id}
          AND s.active = TRUE
          AND COALESCE(s.enrollment_at, s.created_at::date) <= ${lessonDateRaw}::date
        ON CONFLICT (lesson_id, student_id) DO NOTHING
      `
    }
  })

  const [updated] = await db`
    SELECT *
    FROM teacher_grade_lessons
    WHERE id = ${lessonId}
    LIMIT 1
  `

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Somente administradores podem excluir aulas." },
      { status: 403 },
    )
  }

  const resolved = await ctx.params
  const lessonId = String(resolved?.id ?? "").trim()
  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: "Aula invalida" }, { status: 400 })
  }

  const lesson = await loadOwnedLesson(auth.teacherId, lessonId)
  if (!lesson) {
    return NextResponse.json({ error: "Aula nao encontrada" }, { status: 404 })
  }

  const lock = await getBimesterLock(
    String(lesson.class_id),
    Number(lesson.school_year),
    Number(lesson.bimester),
  )
  if (lock) {
    return NextResponse.json(
      { error: "Este bimestre esta fechado e nao permite excluir aulas." },
      { status: 409 },
    )
  }

  let deleted: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    const [removedLesson] = await sql`
      DELETE FROM teacher_grade_lessons
      WHERE id = ${lessonId}
        AND teacher_id = ${auth.teacherId}
      RETURNING id, class_id, lesson_number, lesson_date, bimester
    `

    if (!removedLesson) return

    deleted = removedLesson

    const removedByNumber = await sql`
      WITH candidate AS (
        SELECT id
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_id = ${removedLesson.class_id}
          AND lesson_number = ${removedLesson.lesson_number}
          AND COALESCE(
            bimester::int,
            CASE
              WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
              WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
              WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
              ELSE 4
            END
          ) = ${removedLesson.bimester}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      DELETE FROM teacher_lesson_logs l
      USING candidate c
      WHERE l.id = c.id
      RETURNING l.id
    `

    if (removedByNumber.length > 0) return

    await sql`
      WITH candidate AS (
        SELECT id
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_id = ${removedLesson.class_id}
          AND lesson_date = ${removedLesson.lesson_date}::date
          AND COALESCE(
            bimester::int,
            CASE
              WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 1 AND 3 THEN 1
              WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 4 AND 6 THEN 2
              WHEN EXTRACT(MONTH FROM lesson_date)::int BETWEEN 7 AND 9 THEN 3
              ELSE 4
            END
          ) = ${removedLesson.bimester}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      DELETE FROM teacher_lesson_logs l
      USING candidate c
      WHERE l.id = c.id
    `
  })

  if (!deleted) {
    return NextResponse.json({ error: "Aula nao encontrada" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
