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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response
  const isAdmin = auth.teacher.is_admin === true || auth.teacher.role === "admin"

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const classId = String(resolved?.id ?? "").trim()
  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
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

  const students = await db`
    SELECT
      s.id,
      s.full_name,
      s.enrollment_code,
      s.active
    FROM teacher_class_students s
    WHERE s.class_id = ${classId}
    ORDER BY s.full_name ASC
  `

  const entryMetrics = await db`
    SELECT
      e.student_id,
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
    GROUP BY e.student_id, l.bimester
  `

  const bimesterGrades = await db`
    SELECT
      bg.student_id,
      bg.bimester,
      bg.has_exam,
      bg.exam_score,
      bg.c5_score,
      bg.manual_final_score,
      bg.notes,
      bg.updated_at
    FROM teacher_bimester_grades bg
    WHERE bg.class_id = ${classId}
      AND bg.school_year = ${schoolYear}
  `

  const metricsMap = new Map<string, any>()
  for (const row of entryMetrics) {
    metricsMap.set(`${row.student_id}:${row.bimester}`, row)
  }

  const gradesMap = new Map<string, any>()
  for (const row of bimesterGrades) {
    gradesMap.set(`${row.student_id}:${row.bimester}`, row)
  }

  const result = students.map((student: any) => {
    let totalEntries = 0
    let totalPresence = 0
    let totalAbsence = 0

    const bimesters = [1, 2, 3, 4].map((bimester) => {
      const metric = metricsMap.get(`${student.id}:${bimester}`)
      const grade = gradesMap.get(`${student.id}:${bimester}`)

      const note1 = metric?.note1 === null || metric?.note1 === undefined ? null : Number(metric.note1)
      const hasExam = true
      const examScore =
        grade?.exam_score === null || grade?.exam_score === undefined ? null : Number(grade.exam_score)
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

      totalEntries += entriesCount
      totalPresence += presenceCount
      totalAbsence += absenceCount

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

    const attendancePercent = totalEntries > 0 ? round((totalPresence / totalEntries) * 100, 2) : null

    return {
      student_id: student.id,
      full_name: student.full_name,
      enrollment_code: student.enrollment_code,
      active: student.active === true,
      entries_count: totalEntries,
      presence_count: totalPresence,
      absence_count: totalAbsence,
      attendance_percent: attendancePercent,
      bimesters,
      b1_final_grade: bimesters[0]?.final_grade ?? null,
      b2_final_grade: bimesters[1]?.final_grade ?? null,
      b3_final_grade: bimesters[2]?.final_grade ?? null,
      b4_final_grade: bimesters[3]?.final_grade ?? null,
    }
  })

  return NextResponse.json({
    class: {
      id: classRow.id,
      name: classRow.name,
      school_year: schoolYear,
      student_year: classRow.student_year,
      active: classRow.active,
    },
    students: result,
  })
}
