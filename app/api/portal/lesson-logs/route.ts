import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { getDefaultTimezone } from "@/lib/timezones"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  getBimesterLock,
  isUuid,
  normalizeAttendance,
  normalizeBimester,
  normalizeSchoolYear,
  normalizeScore,
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

function inferBimesterFromDate(value: string) {
  if (!isValidDate(value)) return null
  const month = Number(value.slice(5, 7))
  if (!Number.isFinite(month)) return null
  if (month >= 1 && month <= 3) return 1
  if (month >= 4 && month <= 6) return 2
  if (month >= 7 && month <= 9) return 3
  return 4
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()

  const { searchParams } = new URL(req.url)
  const classId = String(searchParams.get("classId") ?? "").trim()
  const scheduleId = String(searchParams.get("scheduleId") ?? "").trim()
  const classLabel = searchParams.get("class")?.trim() || null

  let rows: any[] = []

  if (classId && isUuid(classId)) {
    rows = await db`
      SELECT *
      FROM teacher_lesson_logs
      WHERE teacher_id = ${auth.teacherId}
        AND class_id = ${classId}
      ORDER BY class_label ASC, lesson_number DESC, lesson_date DESC
    `
  } else if (scheduleId && isUuid(scheduleId)) {
    rows = await db`
      SELECT *
      FROM teacher_lesson_logs
      WHERE teacher_id = ${auth.teacherId}
        AND schedule_id = ${scheduleId}
      ORDER BY class_label ASC, lesson_number DESC, lesson_date DESC
    `
  } else if (classLabel) {
    rows = await db`
      SELECT *
      FROM teacher_lesson_logs
      WHERE teacher_id = ${auth.teacherId}
        AND class_label = ${classLabel}
      ORDER BY class_label ASC, lesson_number DESC, lesson_date DESC
    `
  } else {
    rows = await db`
      SELECT *
      FROM teacher_lesson_logs
      WHERE teacher_id = ${auth.teacherId}
      ORDER BY class_label ASC, lesson_number DESC, lesson_date DESC
    `
  }

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()
  const scoreMax = getScoreMaxByCountry(auth.teacher.country)

  const body = await req.json()
  const schedule_id_raw = String(body.schedule_id ?? "").trim()
  const schedule_id = schedule_id_raw && isUuid(schedule_id_raw) ? schedule_id_raw : null
  const class_id_raw = String(body.class_id ?? "").trim()
  let class_id = class_id_raw && isUuid(class_id_raw) ? class_id_raw : null
  let class_label = String(body.class_label ?? "").trim()
  let timezone: string | null = null
  let scheduleEntryType: "class" | "event" = "class"

  if (schedule_id) {
    const [schedule] = await db`
      SELECT id, class_id, class_label, timezone, entry_type
      FROM teacher_schedules
      WHERE id = ${schedule_id}
        AND teacher_id = ${auth.teacherId}
      LIMIT 1
    `

    if (!schedule) {
      return NextResponse.json({ error: "Agendamento invalido" }, { status: 400 })
    }

    scheduleEntryType = String(schedule.entry_type ?? "class") === "event" ? "event" : "class"
    class_label = String(schedule.class_label ?? "").trim()
    timezone = schedule.timezone

    if (schedule.class_id) {
      class_id = String(schedule.class_id)
    }
  }

  if (scheduleEntryType === "event" && !class_id) {
    return NextResponse.json({ error: "Eventos nao geram lancamento de aula." }, { status: 400 })
  }

  if (class_id) {
    const [classRow] = await db`
      SELECT id, name
      FROM teacher_classes
      WHERE id = ${class_id}
        AND teacher_id = ${auth.teacherId}
      LIMIT 1
    `

    if (!classRow) {
      return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
    }

    if (!class_label) {
      class_label = String(classRow.name ?? "").trim()
    }
  }

  if (!class_label) {
    return NextResponse.json({ error: "Turma obrigatoria" }, { status: 400 })
  }

  const lesson_date_raw = String(body.lesson_date ?? "").trim()
  let lesson_date = ""
  if (lesson_date_raw) {
    if (!isValidDate(lesson_date_raw)) {
      return NextResponse.json({ error: "Data invalida" }, { status: 400 })
    }
    lesson_date = lesson_date_raw
  } else {
    const tz = timezone ?? getDefaultTimezone(auth.teacher.country)
    lesson_date = getTodayInTimeZone(tz)
  }

  const notes = typeof body.notes === "string" ? body.notes : ""
  const observations = typeof body.observations === "string" ? body.observations : ""

  const school_year = normalizeSchoolYear(body.school_year)
  if (school_year === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  let bimester = normalizeBimester(body.bimester)
  const inferredBimester = inferBimesterFromDate(lesson_date)
  if (class_id && bimester === null) {
    bimester = inferredBimester
  }
  if (class_id && bimester === null) {
    return NextResponse.json({ error: "Bimestre invalido" }, { status: 400 })
  }
  if (class_id && bimester !== null) {
    const lock = await getBimesterLock(class_id, school_year, bimester)
    if (lock) {
      return NextResponse.json(
        { error: "Este bimestre esta fechado e nao permite novos lancamentos." },
        { status: 400 },
      )
    }
  }

  const incomingEntries = Array.isArray(body.entries) ? body.entries : []
  const parsedEntries: Array<{
    student_id: string
    attendance: "present" | "absent"
    c1: number | null
    c2: number | null
    c3: number | null
    c4: number | null
    comment: string | null
  }> = incomingEntries
    .map((entry: any) => ({
      student_id: String(entry?.student_id ?? "").trim(),
      attendance: normalizeAttendance(entry?.attendance),
      c1: normalizeScore(entry?.c1, scoreMax),
      c2: normalizeScore(entry?.c2, scoreMax),
      c3: normalizeScore(entry?.c3, scoreMax),
      c4: normalizeScore(entry?.c4, scoreMax),
      comment: typeof entry?.comment === "string" ? entry.comment.trim() : null,
    }))
    .filter((entry: any) => isUuid(entry.student_id))

  if (class_id && parsedEntries.length > 0) {
    const ids = parsedEntries.map((item) => item.student_id)
    const validStudents = await db`
      SELECT id
      FROM teacher_class_students
      WHERE class_id = ${class_id}
        AND id = ANY(${ids}::uuid[])
    `
    if (validStudents.length !== ids.length) {
      return NextResponse.json({ error: "Existe aluno invalido no lancamento" }, { status: 400 })
    }
  }

  let created: any = null

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx

    let lastRows: any[] = []

    if (class_id) {
      lastRows = await sql`
        SELECT lesson_number
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_id = ${class_id}
        ORDER BY lesson_number DESC
        LIMIT 1
        FOR UPDATE
      `
    } else if (schedule_id) {
      lastRows = await sql`
        SELECT lesson_number
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND schedule_id = ${schedule_id}
          AND class_id IS NULL
        ORDER BY lesson_number DESC
        LIMIT 1
        FOR UPDATE
      `
    } else {
      lastRows = await sql`
        SELECT lesson_number
        FROM teacher_lesson_logs
        WHERE teacher_id = ${auth.teacherId}
          AND class_label = ${class_label}
          AND class_id IS NULL
          AND schedule_id IS NULL
        ORDER BY lesson_number DESC
        LIMIT 1
        FOR UPDATE
      `
    }

    const last = lastRows[0]
    const nextNumber = Number(last?.lesson_number ?? 0) + 1
    const bimesterToPersist = bimester ?? inferredBimester ?? null

    if (class_id && bimester !== null) {
      const [gradeLesson] = await sql`
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
          ${class_id},
          ${school_year},
          ${bimester},
          ${nextNumber},
          ${lesson_date},
          ${notes || null}
        )
        ON CONFLICT (class_id, school_year, bimester, lesson_number)
        DO UPDATE SET
          lesson_date = EXCLUDED.lesson_date,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING *
      `

      if (parsedEntries.length > 0) {
        for (const entry of parsedEntries) {
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
              ${gradeLesson.id},
              ${entry.student_id},
              ${entry.attendance},
              ${entry.c1},
              ${entry.c2},
              ${entry.c3},
              ${entry.c4},
              ${entry.comment},
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
      } else {
        await sql`
          INSERT INTO teacher_grade_entries (lesson_id, student_id, attendance)
          SELECT ${gradeLesson.id}::uuid, s.id, 'present'
          FROM teacher_class_students s
          WHERE s.class_id = ${class_id}
            AND s.active = TRUE
          ON CONFLICT (lesson_id, student_id) DO NOTHING
        `
      }
    }

    const [row] = await sql`
      INSERT INTO teacher_lesson_logs (
        teacher_id,
        schedule_id,
        class_id,
        class_label,
        school_year,
        bimester,
        lesson_number,
        lesson_date,
        notes,
        observations
      )
      VALUES (
        ${auth.teacherId},
        ${schedule_id},
        ${class_id},
        ${class_label},
        ${school_year},
        ${bimesterToPersist},
        ${nextNumber},
        ${lesson_date},
        ${notes},
        ${observations}
      )
      RETURNING *
    `

    created = row
  })

  await writeAuditLog({
    req,
    action: "teacher.lesson_logs.create",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "lesson_log", id: created?.id },
    metadata: {
      class_id,
      class_label,
      lesson_number: created?.lesson_number,
      lesson_date,
      schedule_id,
      school_year,
      bimester: bimester ?? null,
      grade_entry_count: parsedEntries.length,
      has_notes: notes.length > 0,
      has_observations: observations.length > 0,
    },
  })

  return NextResponse.json(created)
}
