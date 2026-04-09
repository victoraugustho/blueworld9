import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { getDefaultTimezone } from "@/lib/timezones"
import {
  ensureGradebookSchema,
  getBimesterLock,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
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

  const rows = await db`
    SELECT
      l.*,
      COUNT(e.student_id)::int AS entries_count,
      COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absences_count
    FROM teacher_grade_lessons l
    LEFT JOIN teacher_grade_entries e
      ON e.lesson_id = l.id
    WHERE l.teacher_id = ${auth.teacherId}
      AND l.class_id = ${classId}
      AND l.school_year = ${schoolYear}
      AND l.bimester = ${bimester}
    GROUP BY l.id
    ORDER BY l.lesson_number ASC
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

  const lock = await getBimesterLock(classId, schoolYear, bimester)
  if (lock) {
    return NextResponse.json(
      { error: "Este bimestre esta fechado e nao permite novos lancamentos." },
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
        notes
      )
      VALUES (
        ${auth.teacherId},
        ${classId},
        ${schoolYear},
        ${bimester},
        ${nextNumber},
        ${lessonDate},
        ${notes || null}
      )
      RETURNING *
    `

    await sql`
      INSERT INTO teacher_grade_entries (lesson_id, student_id, attendance)
      SELECT ${lesson.id}::uuid, s.id, 'present'
      FROM teacher_class_students s
      WHERE s.class_id = ${classId}
        AND s.active = TRUE
      ON CONFLICT (lesson_id, student_id) DO NOTHING
    `

    created = lesson
  })

  return NextResponse.json(created)
}
