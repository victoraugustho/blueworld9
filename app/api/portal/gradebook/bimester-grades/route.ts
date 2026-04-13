import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  getBimesterLock,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
  normalizeScore,
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

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

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

  const classRow = await loadOwnedClass(auth.teacherId, classId)
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const rows = await db`
    SELECT
      s.id AS student_id,
      s.full_name,
      s.enrollment_code,
      s.active,
      TRUE AS has_exam,
      bg.exam_score,
      bg.c5_score,
      bg.manual_final_score,
      bg.notes,
      bg.updated_at
    FROM teacher_class_students s
    LEFT JOIN teacher_bimester_grades bg
      ON bg.class_id = ${classId}
     AND bg.student_id = s.id
     AND bg.school_year = ${schoolYear}
     AND bg.bimester = ${bimester}
    WHERE s.class_id = ${classId}
      AND s.active = TRUE
    ORDER BY s.full_name ASC
  `

  return NextResponse.json(rows)
}

export async function PUT(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureGradebookSchema()
  const note2ComponentMax = 5

  const body = await req.json().catch(() => ({}))
  const classId = String(body.class_id ?? "").trim()
  const bimester = normalizeBimester(body.bimester)
  const schoolYear = normalizeSchoolYear(body.school_year)
  const grades = Array.isArray(body.grades) ? body.grades : []

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
  const scoreMax = getScoreMaxByCountry(classRow.teacher_country ?? auth.teacher.country)

  const lock = await getBimesterLock(classId, schoolYear, bimester)
  if (lock) {
    return NextResponse.json(
      { error: "Este bimestre esta fechado e nao permite alterar o resumo." },
      { status: 409 },
    )
  }

  const studentIds = grades
     .map((item: any) => String(item?.student_id ?? "").trim())
     .filter((id: string) => isUuid(id))

  if (studentIds.length > 0) {
    const validStudents = await db`
      SELECT id
      FROM teacher_class_students
      WHERE class_id = ${classId}
        AND id = ANY(${studentIds}::uuid[])
    `
    if (validStudents.length !== studentIds.length) {
      return NextResponse.json({ error: "Existe aluno invalido na nota bimestral" }, { status: 400 })
    }
  }

  for (const item of grades) {
    const studentId = String(item?.student_id ?? "").trim()
    if (!isUuid(studentId)) continue

    const examScoreRaw = item?.exam_score
    const examScoreRawText = String(examScoreRaw ?? "").trim()
    if (!examScoreRawText) {
      return NextResponse.json(
        { error: "Campo Prova/Atividade obrigatorio para todos os alunos" },
        { status: 400 },
      )
    }
    const examScore = normalizeScore(examScoreRaw, note2ComponentMax)
    if (examScore === null) {
      return NextResponse.json(
        { error: `Campo Prova/Atividade invalido (use valores de 0 a ${note2ComponentMax})` },
        { status: 400 },
      )
    }

    const c5ScoreRaw = item?.c5_score
    if (
      c5ScoreRaw !== undefined &&
      c5ScoreRaw !== null &&
      String(c5ScoreRaw).trim() !== "" &&
      normalizeScore(c5ScoreRaw, note2ComponentMax) === null
    ) {
      return NextResponse.json(
        { error: `Campo C5 invalido (use valores de 0 a ${note2ComponentMax})` },
        { status: 400 },
      )
    }

    const manualFinalScoreRaw = item?.manual_final_score
    if (
      manualFinalScoreRaw !== undefined &&
      manualFinalScoreRaw !== null &&
      String(manualFinalScoreRaw).trim() !== "" &&
      normalizeScore(manualFinalScoreRaw, scoreMax) === null
    ) {
      return NextResponse.json(
        { error: `Campo Nota Final Manual invalido (use valores de 0 a ${scoreMax})` },
        { status: 400 },
      )
    }
  }

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx
    for (const item of grades) {
      const studentId = String(item?.student_id ?? "").trim()
      if (!isUuid(studentId)) continue

      const hasExam = true
      const examScore = normalizeScore(item?.exam_score, note2ComponentMax)
      const c5Score = normalizeScore(item?.c5_score, note2ComponentMax)
      const manualFinalScore = normalizeScore(item?.manual_final_score, scoreMax)
      const notes = typeof item?.notes === "string" ? item.notes.trim() : null

      await sql`
        INSERT INTO teacher_bimester_grades (
          class_id,
          student_id,
          school_year,
          bimester,
          has_exam,
          exam_score,
          c5_score,
          manual_final_score,
          notes,
          updated_at
        )
        VALUES (
          ${classId},
          ${studentId},
          ${schoolYear},
          ${bimester},
          ${hasExam},
          ${examScore},
          ${c5Score},
          ${manualFinalScore},
          ${notes},
          NOW()
        )
        ON CONFLICT (class_id, student_id, school_year, bimester)
        DO UPDATE SET
          has_exam = EXCLUDED.has_exam,
          exam_score = EXCLUDED.exam_score,
          c5_score = EXCLUDED.c5_score,
          manual_final_score = EXCLUDED.manual_final_score,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `
    }
  })

  return NextResponse.json({ ok: true })
}
