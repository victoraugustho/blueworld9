import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { getDefaultTimezone } from "@/lib/timezones"
import {
  ensureGradebookSchema,
  getBimesterLock,
  isUuid,
  normalizeAttendance,
  normalizeScore,
} from "@/lib/gradebook"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

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
    ORDER BY s.full_name ASC
  `

  return NextResponse.json({
    lesson,
    entries,
  })
}

export async function PUT(req: NextRequest, ctx: Ctx) {
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
  const notes = typeof body.notes === "string" ? body.notes.trim() : String(lesson.notes ?? "")
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
        notes = ${notes || null}
      WHERE id = ${lessonId}
    `

    for (const entry of entries) {
      const studentId = String(entry?.student_id ?? "").trim()
      if (!isUuid(studentId)) continue

      const attendance = normalizeAttendance(entry?.attendance)
      const c1 = normalizeScore(entry?.c1)
      const c2 = normalizeScore(entry?.c2)
      const c3 = normalizeScore(entry?.c3)
      const c4 = normalizeScore(entry?.c4)
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

  const [deleted] = await db`
    DELETE FROM teacher_grade_lessons
    WHERE id = ${lessonId}
      AND teacher_id = ${auth.teacherId}
    RETURNING id
  `

  if (!deleted) {
    return NextResponse.json({ error: "Aula nao encontrada" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
