import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { isAdminUser } from "@/lib/auth/authorization"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
} from "@/lib/gradebook"

type Ctx = { params: Promise<{ id: string }> }

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(2).replace(".", ",")
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return `${Number(value).toFixed(1).replace(".", ",")}%`
}

function safeFilenamePart(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return normalized || "turma"
}

async function loadClassByScope(params: { classId: string; teacherId: string; isAdmin: boolean }) {
  const { classId, teacherId, isAdmin } = params
  const [row] = isAdmin
    ? await db`
        SELECT
          tc.*,
          t.country AS teacher_country
        FROM teacher_classes tc
        LEFT JOIN teachers t
          ON t.id = tc.teacher_id
        WHERE tc.id = ${classId}
        LIMIT 1
      `
    : await db`
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

async function loadExportRows(params: {
  classId: string
  bimester: number
  schoolYear: number
  isPyScoreScale: boolean
}) {
  const { classId, bimester, schoolYear, isPyScoreScale } = params

  const rows = await db`
    WITH lesson_scope AS (
      SELECT l.id, l.lesson_date
      FROM teacher_grade_lessons l
      WHERE l.class_id = ${classId}
        AND l.school_year = ${schoolYear}
        AND l.bimester = ${bimester}
        AND COALESCE(l.has_grades, TRUE) = TRUE
    ),
    lesson_metrics AS (
      SELECT
        e.student_id,
        COUNT(*) FILTER (
          WHERE e.attendance = 'absent'
             OR (
              e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL
            )
        )::int AS graded_lessons,
        ROUND(
          AVG(
            CASE
              WHEN e.attendance = 'absent' THEN 0
              ELSE (e.c1 + e.c2 + e.c3 + e.c4) / 4.0
            END
          )
          FILTER (
            WHERE e.attendance = 'absent'
               OR (
                e.c1 IS NOT NULL
                AND e.c2 IS NOT NULL
                AND e.c3 IS NOT NULL
                AND e.c4 IS NOT NULL
              )
          )::numeric,
          2
        ) AS note1,
        COUNT(*) FILTER (WHERE e.attendance = 'present')::int AS presence_count,
        COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absence_count
      FROM teacher_grade_entries e
      JOIN lesson_scope ls
        ON ls.id = e.lesson_id
      JOIN teacher_class_students ss
        ON ss.id = e.student_id
       AND ss.class_id = ${classId}
       AND COALESCE(ss.enrollment_at, ss.created_at::date) <= ls.lesson_date::date
      GROUP BY e.student_id
    ),
    base AS (
      SELECT
        s.id AS student_id,
        s.full_name,
        COALESCE(lm.graded_lessons, 0)::int AS graded_lessons,
        lm.note1,
        COALESCE(lm.presence_count, 0)::int AS presence_count,
        COALESCE(lm.absence_count, 0)::int AS absence_count,
        bg.exam_score,
        bg.c5_score,
        bg.manual_final_score,
        bg.notes AS observations
      FROM teacher_class_students s
      LEFT JOIN lesson_metrics lm
        ON lm.student_id = s.id
      LEFT JOIN teacher_bimester_grades bg
        ON bg.class_id = ${classId}
       AND bg.student_id = s.id
       AND bg.school_year = ${schoolYear}
       AND bg.bimester = ${bimester}
      WHERE s.class_id = ${classId}
        AND s.active = TRUE
    )
    SELECT
      b.student_id,
      b.full_name,
      b.graded_lessons,
      b.presence_count,
      b.absence_count,
      CASE
        WHEN (b.presence_count + b.absence_count) > 0
          THEN ROUND((b.presence_count::numeric / (b.presence_count + b.absence_count)::numeric) * 100.0, 2)
        ELSE NULL
      END AS attendance_percent,
      b.note1,
      b.exam_score,
      b.c5_score,
      CASE
        WHEN b.exam_score IS NOT NULL
         AND b.c5_score IS NOT NULL
          THEN ROUND(
            (
              CASE
                WHEN ${isPyScoreScale}
                  THEN ((b.exam_score + b.c5_score) / 2.0)
                ELSE (b.exam_score + b.c5_score)
              END
            )::numeric,
            2
          )
        ELSE NULL
      END AS note2,
      b.manual_final_score,
      CASE
        WHEN b.manual_final_score IS NOT NULL THEN b.manual_final_score
        WHEN b.note1 IS NOT NULL
         AND b.exam_score IS NOT NULL
         AND b.c5_score IS NOT NULL
          THEN ROUND(
            (
              b.note1 + (
                CASE
                  WHEN ${isPyScoreScale}
                    THEN ((b.exam_score + b.c5_score) / 2.0)
                  ELSE (b.exam_score + b.c5_score)
                END
              )
            ) / 2.0
          , 2)
        ELSE NULL
      END AS final_grade,
      b.observations
    FROM base b
    ORDER BY b.full_name ASC
  `

  return rows
}

async function buildPdfBuffer(params: {
  className: string
  schoolYear: number
  bimester: number
  rows: any[]
}) {
  const { className, schoolYear, bimester, rows } = params
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [842, 595]
  let page = pdf.addPage(pageSize)
  const marginX = 28
  const topY = page.getHeight() - 28
  const rowHeight = 16
  const fontSize = 8
  const cols = [
    { key: "full_name", label: "Aluno", width: 150 },
    { key: "presence_count", label: "Pres.", width: 34 },
    { key: "absence_count", label: "Falt.", width: 34 },
    { key: "attendance_percent", label: "Freq.", width: 44 },
    { key: "graded_lessons", label: "Aulas", width: 36 },
    { key: "note1", label: "Nota1", width: 42 },
    { key: "exam_score", label: "Prova", width: 42 },
    { key: "c5_score", label: "C5", width: 34 },
    { key: "note2", label: "Nota2", width: 42 },
    { key: "final_grade", label: "Final", width: 42 },
    { key: "observations", label: "Observacoes", width: 200 },
  ]

  const totalWidth = cols.reduce((sum, col) => sum + col.width, 0)

  function textFit(value: string, width: number, useFont = font) {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim()
    if (!clean) return "-"
    if (useFont.widthOfTextAtSize(clean, fontSize) <= width - 6) return clean
    let out = clean
    while (out.length > 1 && useFont.widthOfTextAtSize(`${out}...`, fontSize) > width - 6) {
      out = out.slice(0, -1)
    }
    return `${out}...`
  }

  function drawHeader(currentPage: typeof page) {
    currentPage.drawRectangle({
      x: marginX - 2,
      y: topY - 40,
      width: totalWidth + 4,
      height: 46,
      color: rgb(0.93, 0.96, 1),
    })

    currentPage.drawText("BlueWorld9 - Exportacao de Notas", {
      x: marginX,
      y: topY,
      size: 12,
      font: bold,
      color: rgb(0.09, 0.16, 0.28),
    })
    currentPage.drawText(`Turma: ${className} | Ano: ${schoolYear} | Bimestre: ${bimester}`, {
      x: marginX,
      y: topY - 14,
      size: 9,
      font,
      color: rgb(0.18, 0.27, 0.4),
    })
    let x = marginX
    for (const col of cols) {
      currentPage.drawText(col.label, {
        x: x + 2,
        y: topY - 34,
        size: fontSize,
        font: bold,
        color: rgb(0.12, 0.2, 0.33),
      })
      x += col.width
    }
    currentPage.drawLine({
      start: { x: marginX, y: topY - 38 },
      end: { x: marginX + totalWidth, y: topY - 38 },
      thickness: 0.8,
      color: rgb(0.7, 0.7, 0.7),
    })
  }

  drawHeader(page)
  let y = topY - 50

  for (const row of rows) {
    if (y < 28) {
      page = pdf.addPage(pageSize)
      drawHeader(page)
      y = topY - 50
    }
    const values: Record<string, string> = {
      full_name: String(row.full_name ?? "-"),
      presence_count: String(Number(row.presence_count ?? 0)),
      absence_count: String(Number(row.absence_count ?? 0)),
      attendance_percent: formatPercent(row.attendance_percent),
      graded_lessons: String(Number(row.graded_lessons ?? 0)),
      note1: formatScore(row.note1),
      exam_score: formatScore(row.exam_score),
      c5_score: formatScore(row.c5_score),
      note2: formatScore(row.note2),
      final_grade: formatScore(row.final_grade),
      observations: String(row.observations ?? "-"),
    }

    let x = marginX
    for (const col of cols) {
      page.drawText(textFit(values[col.key], col.width), {
        x: x + 2,
        y,
        size: fontSize,
        font,
        color: rgb(0.08, 0.08, 0.08),
      })
      x += col.width
    }
    y -= rowHeight
  }

  return Buffer.from(await pdf.save())
}

async function buildXlsxBuffer(rows: any[]) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Notas")

  worksheet.columns = [
    { header: "Aluno", key: "full_name", width: 34 },
    { header: "Presencas", key: "presence_count", width: 10 },
    { header: "Faltas", key: "absence_count", width: 9 },
    { header: "Frequencia", key: "attendance_percent", width: 12 },
    { header: "Aulas avaliadas", key: "graded_lessons", width: 14 },
    { header: "Nota 1", key: "note1", width: 10 },
    { header: "Prova/Atividade", key: "exam_score", width: 14 },
    { header: "C5", key: "c5_score", width: 8 },
    { header: "Nota 2", key: "note2", width: 10 },
    { header: "Nota Final", key: "final_grade", width: 12 },
    { header: "Observacoes", key: "observations", width: 34 },
  ]

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }

  for (const row of rows) {
    worksheet.addRow({
      full_name: String(row.full_name ?? ""),
      presence_count: Number(row.presence_count ?? 0),
      absence_count: Number(row.absence_count ?? 0),
      attendance_percent: formatPercent(row.attendance_percent),
      graded_lessons: Number(row.graded_lessons ?? 0),
      note1: row.note1 === null || row.note1 === undefined ? "" : Number(row.note1),
      exam_score: row.exam_score === null || row.exam_score === undefined ? "" : Number(row.exam_score),
      c5_score: row.c5_score === null || row.c5_score === undefined ? "" : Number(row.c5_score),
      note2: row.note2 === null || row.note2 === undefined ? "" : Number(row.note2),
      final_grade: row.final_grade === null || row.final_grade === undefined ? "" : Number(row.final_grade),
      observations: String(row.observations ?? ""),
    })
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  if (auth.teacher.can_download === false) {
    return NextResponse.json({ error: "Downloads nao permitidos para este acesso." }, { status: 403 })
  }

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const classId = String(resolved?.id ?? "").trim()
  const search = new URL(req.url).searchParams
  const format = String(search.get("format") ?? "xlsx").trim().toLowerCase()
  const bimester = normalizeBimester(search.get("bimester"))
  const schoolYear = normalizeSchoolYear(search.get("schoolYear"))
  const isAdmin = isAdminUser(auth.teacher)

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma invalida" }, { status: 400 })
  }
  if (bimester === null) {
    return NextResponse.json({ error: "Bimestre invalido" }, { status: 400 })
  }
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Formato invalido. Use xlsx ou pdf." }, { status: 400 })
  }

  const classRow = await loadClassByScope({
    classId,
    teacherId: auth.teacherId,
    isAdmin,
  })
  if (!classRow) {
    return NextResponse.json({ error: "Turma nao encontrada" }, { status: 404 })
  }

  const isPyScoreScale = getScoreMaxByCountry(classRow.teacher_country ?? auth.teacher.country) <= 5
  const rows = await loadExportRows({
    classId,
    bimester,
    schoolYear,
    isPyScoreScale,
  })

  const filenameBase = `${safeFilenamePart(String(classRow.name ?? "turma"))}-B${bimester}-${schoolYear}`

  if (format === "xlsx") {
    const buffer = await buildXlsxBuffer(rows)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    })
  }

  const pdfBuffer = await buildPdfBuffer({
    className: String(classRow.name ?? "Turma"),
    schoolYear,
    bimester,
    rows,
  })

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  })
}
