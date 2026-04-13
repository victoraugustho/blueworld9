import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  isUuid,
  normalizeSchoolYear,
} from "@/lib/gradebook"

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function calcNote2(examScore: number | null, c5Score: number | null, isPyScoreScale: boolean) {
  if (examScore === null || c5Score === null) return null
  const value = isPyScoreScale ? (examScore + c5Score) / 2 : examScore + c5Score
  return round(value, 2)
}

function calcFinal(note1: number | null, note2: number | null) {
  if (note1 === null || note2 === null) return null
  return round((note1 + note2) / 2, 2)
}

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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; studentId: string }> | { id: string; studentId: string } },
) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const classId = String(resolved?.id ?? "").trim()
  const studentId = String(resolved?.studentId ?? "").trim()

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }

  if (!isUuid(studentId)) {
    return NextResponse.json({ error: "Aluno invalido" }, { status: 400 })
  }

  const classRow = isAdmin
    ? await loadClass(classId)
    : await loadOwnedClass(auth.teacherId, classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }
  const isPyScoreScale = getScoreMaxByCountry(classRow.teacher_country ?? auth.teacher.country) <= 5

  const search = new URL(req.url).searchParams
  const schoolYear = normalizeSchoolYear(search.get("schoolYear") ?? classRow.school_year)
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  const [student] = await db`
    SELECT
      s.id,
      s.class_id,
      s.full_name,
      s.enrollment_code,
      s.active,
      s.created_at,
      s.updated_at
    FROM teacher_class_students s
    WHERE s.id = ${studentId}
      AND s.class_id = ${classId}
    LIMIT 1
  `

  if (!student) {
    return NextResponse.json({ error: "Aluno nao encontrado" }, { status: 404 })
  }

  const perBimesterMetrics = await db`
    SELECT
      l.bimester,
      COUNT(*)::int AS entries_count,
      COUNT(*) FILTER (WHERE e.attendance = 'present')::int AS presence_count,
      COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absence_count,
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
      ) AS note1
    FROM teacher_grade_entries e
    JOIN teacher_grade_lessons l
      ON l.id = e.lesson_id
    WHERE l.class_id = ${classId}
      AND l.school_year = ${schoolYear}
      AND e.student_id = ${studentId}
    GROUP BY l.bimester
    ORDER BY l.bimester ASC
  `

  const bimesterGrades = await db`
    SELECT
      bg.bimester,
      bg.has_exam,
      bg.exam_score,
      bg.c5_score,
      bg.manual_final_score,
      bg.notes,
      bg.updated_at
    FROM teacher_bimester_grades bg
    WHERE bg.class_id = ${classId}
      AND bg.student_id = ${studentId}
      AND bg.school_year = ${schoolYear}
    ORDER BY bg.bimester ASC
  `

  const lessonHistory = await db`
    SELECT
      l.id AS lesson_id,
      l.bimester,
      l.lesson_number,
      l.lesson_date,
      l.notes AS lesson_notes,
      e.attendance,
      e.c1,
      e.c2,
      e.c3,
      e.c4,
      e.comment,
      e.updated_at
    FROM teacher_grade_lessons l
    LEFT JOIN teacher_grade_entries e
      ON e.lesson_id = l.id
     AND e.student_id = ${studentId}
    WHERE l.class_id = ${classId}
      AND l.school_year = ${schoolYear}
    ORDER BY l.bimester ASC, l.lesson_number ASC
  `

  const metricsMap = new Map<number, any>()
  for (const row of perBimesterMetrics) {
    metricsMap.set(Number(row.bimester), row)
  }

  const gradesMap = new Map<number, any>()
  for (const row of bimesterGrades) {
    gradesMap.set(Number(row.bimester), row)
  }

  let entriesTotal = 0
  let presenceTotal = 0
  let absenceTotal = 0

  const bimesters = [1, 2, 3, 4].map((bimester) => {
    const metric = metricsMap.get(bimester)
    const grade = gradesMap.get(bimester)

    const note1 = metric?.note1 === null || metric?.note1 === undefined ? null : Number(metric.note1)
    const hasExam = true
    const examScore = grade?.exam_score === null || grade?.exam_score === undefined ? null : Number(grade.exam_score)
    const c5Score = grade?.c5_score === null || grade?.c5_score === undefined ? null : Number(grade.c5_score)
    const manualFinalScore =
      grade?.manual_final_score === null || grade?.manual_final_score === undefined
        ? null
        : Number(grade.manual_final_score)
    const note2 = calcNote2(examScore, c5Score, isPyScoreScale)
    const calculatedFinal = calcFinal(note1, note2)
    const finalGrade = manualFinalScore ?? calculatedFinal

    const entriesCount = Number(metric?.entries_count ?? 0)
    const presenceCount = Number(metric?.presence_count ?? 0)
    const absenceCount = Number(metric?.absence_count ?? 0)

    entriesTotal += entriesCount
    presenceTotal += presenceCount
    absenceTotal += absenceCount

    return {
      bimester,
      entries_count: entriesCount,
      graded_lessons: Number(metric?.graded_lessons ?? 0),
      presence_count: presenceCount,
      absence_count: absenceCount,
      note1,
      has_exam: hasExam,
      exam_score: examScore,
      c5_score: c5Score,
      manual_final_score: manualFinalScore,
      note2,
      final_grade: finalGrade,
      notes: grade?.notes ?? null,
      updated_at: grade?.updated_at ?? null,
    }
  })

  const attendancePercent = entriesTotal > 0 ? round((presenceTotal / entriesTotal) * 100, 2) : null

  return NextResponse.json({
    class: {
      id: classRow.id,
      name: classRow.name,
      school_year: schoolYear,
      student_year: classRow.student_year,
      active: classRow.active,
    },
    student: {
      id: student.id,
      full_name: student.full_name,
      enrollment_code: student.enrollment_code,
      active: student.active === true,
      created_at: student.created_at,
      updated_at: student.updated_at,
    },
    totals: {
      entries_count: entriesTotal,
      presence_count: presenceTotal,
      absence_count: absenceTotal,
      attendance_percent: attendancePercent,
    },
    bimesters,
    lessons: lessonHistory.map((row: any) => {
      const c1 = row?.c1 === null || row?.c1 === undefined ? null : Number(row.c1)
      const c2 = row?.c2 === null || row?.c2 === undefined ? null : Number(row.c2)
      const c3 = row?.c3 === null || row?.c3 === undefined ? null : Number(row.c3)
      const c4 = row?.c4 === null || row?.c4 === undefined ? null : Number(row.c4)

      const lessonAverage =
        c1 !== null && c2 !== null && c3 !== null && c4 !== null ? round((c1 + c2 + c3 + c4) / 4, 2) : null

      return {
        lesson_id: row.lesson_id,
        bimester: Number(row.bimester),
        lesson_number: Number(row.lesson_number),
        lesson_date: row.lesson_date,
        lesson_notes: row.lesson_notes ?? null,
        attendance: row.attendance ?? null,
        c1,
        c2,
        c3,
        c4,
        lesson_average: lessonAverage,
        comment: row.comment ?? null,
        updated_at: row.updated_at ?? null,
      }
    }),
  })
}
