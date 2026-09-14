import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { db } from "@/lib/db"
import { requireTeacherPermissionApi } from "@/lib/auth/require"
import { isAdminUser } from "@/lib/auth/authorization"
import {
  ensureGradebookSchema,
  getScoreMaxByCountry,
  isUuid,
  normalizeBimester,
  normalizeSchoolYear,
} from "@/lib/gradebook"

type Ctx = { params: Promise<{ id: string }> }
type ExportReport = "grades" | "complete"

type LessonHistoryEntry = {
  student_id: string
  full_name: string
  attendance: "present" | "absent" | null
  c1: number | null
  c2: number | null
  c3: number | null
  c4: number | null
  comment: string | null
}

type LessonHistoryItem = {
  lesson_number: number
  lesson_date: string
  has_grades: boolean
  diary_notes: string | null
  observations: string | null
  entries: LessonHistoryEntry[]
}

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

function formatDate(value: unknown) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-"
}

function formatLessonNumber(value: unknown) {
  const lessonNumber = Math.max(0, Math.trunc(Number(value) || 0))
  return String(lessonNumber).padStart(2, "0")
}

function reportScoreValue(entry: LessonHistoryEntry, field: "c1" | "c2" | "c3" | "c4") {
  if (entry.attendance === "absent") return 0
  const value = entry[field]
  return value === null || value === undefined ? null : Number(value)
}

function lessonAverage(entry: LessonHistoryEntry) {
  if (entry.attendance === "absent") return 0
  const values = (["c1", "c2", "c3", "c4"] as const).map((field) => reportScoreValue(entry, field))
  if (values.some((value) => value === null)) return null
  return values.reduce<number>((sum, value) => sum + Number(value), 0) / values.length
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

async function loadLessonHistory(params: {
  classId: string
  bimester: number
  schoolYear: number
  includeLessonGrades: boolean
}) {
  const { classId, bimester, schoolYear, includeLessonGrades } = params

  const gradeLessons = await db`
    SELECT
      l.id,
      l.lesson_number,
      l.lesson_date,
      COALESCE(l.has_grades, TRUE) AS has_grades,
      l.notes
    FROM teacher_grade_lessons l
    WHERE l.class_id = ${classId}
      AND l.school_year = ${schoolYear}
      AND l.bimester = ${bimester}
    ORDER BY l.lesson_number ASC, l.lesson_date ASC
  `

  const lessonLogs = await db`
    SELECT
      l.id,
      l.lesson_number,
      l.lesson_date,
      COALESCE(l.has_grades, TRUE) AS has_grades,
      l.notes,
      l.observations
    FROM teacher_lesson_logs l
    WHERE l.class_id = ${classId}
      AND COALESCE(l.school_year, EXTRACT(YEAR FROM l.lesson_date)::smallint) = ${schoolYear}
      AND COALESCE(
        l.bimester,
        CASE
          WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 1 AND 3 THEN 1
          WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 4 AND 6 THEN 2
          WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 7 AND 9 THEN 3
          ELSE 4
        END
      ) = ${bimester}
    ORDER BY l.lesson_number ASC, l.lesson_date ASC, l.updated_at DESC NULLS LAST
  `

  const entryRows = includeLessonGrades
    ? await db`
        SELECT
          l.id AS lesson_id,
          s.id AS student_id,
          s.full_name,
          e.attendance,
          e.c1,
          e.c2,
          e.c3,
          e.c4,
          e.comment
        FROM teacher_grade_lessons l
        JOIN teacher_class_students s
          ON s.class_id = l.class_id
         AND COALESCE(s.enrollment_at, s.created_at::date) <= l.lesson_date::date
        LEFT JOIN teacher_grade_entries e
          ON e.lesson_id = l.id
         AND e.student_id = s.id
        WHERE l.class_id = ${classId}
          AND l.school_year = ${schoolYear}
          AND l.bimester = ${bimester}
          AND (s.active = TRUE OR e.student_id IS NOT NULL)
        ORDER BY l.lesson_number ASC, l.lesson_date ASC, s.full_name ASC
      `
    : []

  const entriesByLesson = new Map<string, LessonHistoryEntry[]>()
  for (const row of entryRows) {
    const lessonId = String(row.lesson_id)
    const current = entriesByLesson.get(lessonId) ?? []
    current.push({
      student_id: String(row.student_id),
      full_name: String(row.full_name ?? ""),
      attendance:
        row.attendance === "absent"
          ? "absent"
          : row.attendance === "present"
            ? "present"
            : null,
      c1: row.c1 === null || row.c1 === undefined ? null : Number(row.c1),
      c2: row.c2 === null || row.c2 === undefined ? null : Number(row.c2),
      c3: row.c3 === null || row.c3 === undefined ? null : Number(row.c3),
      c4: row.c4 === null || row.c4 === undefined ? null : Number(row.c4),
      comment: row.comment ? String(row.comment) : null,
    })
    entriesByLesson.set(lessonId, current)
  }

  const byLessonNumber = new Map<number, LessonHistoryItem>()
  for (const lesson of gradeLessons) {
    const lessonNumber = Number(lesson.lesson_number)
    byLessonNumber.set(lessonNumber, {
      lesson_number: lessonNumber,
      lesson_date: String(lesson.lesson_date ?? ""),
      has_grades: lesson.has_grades !== false,
      diary_notes: lesson.notes ? String(lesson.notes) : null,
      observations: null,
      entries: entriesByLesson.get(String(lesson.id)) ?? [],
    })
  }

  for (const log of lessonLogs) {
    const lessonNumber = Number(log.lesson_number)
    const existing = byLessonNumber.get(lessonNumber)
    if (existing) {
      const logNotes = String(log.notes ?? "").trim()
      const logObservations = String(log.observations ?? "").trim()
      if (logNotes) existing.diary_notes = logNotes
      if (logObservations) existing.observations = logObservations
      existing.has_grades = log.has_grades !== false && existing.has_grades
      continue
    }

    byLessonNumber.set(lessonNumber, {
      lesson_number: lessonNumber,
      lesson_date: String(log.lesson_date ?? ""),
      has_grades: log.has_grades !== false,
      diary_notes: log.notes ? String(log.notes) : null,
      observations: log.observations ? String(log.observations) : null,
      entries: [],
    })
  }

  return Array.from(byLessonNumber.values()).sort((a, b) => {
    const numberCompare = a.lesson_number - b.lesson_number
    return numberCompare !== 0 ? numberCompare : a.lesson_date.localeCompare(b.lesson_date)
  })
}

async function buildPdfBuffer(params: {
  className: string
  schoolYear: number
  bimester: number
  rows: any[]
  lessonHistory?: LessonHistoryItem[]
  includeLessonHistory?: boolean
  includeLessonGrades?: boolean
}) {
  const {
    className,
    schoolYear,
    bimester,
    rows,
    lessonHistory = [],
    includeLessonHistory = false,
    includeLessonGrades = true,
  } = params
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const pageSize: [number, number] = [842, 595]
  const marginX = 28
  const contentWidth = pageSize[0] - marginX * 2
  const topY = pageSize[1] - 70
  const bottomY = 26
  const rowHeight = 14
  const fontSize = 7.5
  const navy = rgb(0.025, 0.12, 0.22)
  const blue = rgb(0.02, 0.45, 0.72)
  const cyan = rgb(0.04, 0.72, 0.78)
  const ink = rgb(0.08, 0.12, 0.18)
  const muted = rgb(0.35, 0.41, 0.49)
  const lineColor = rgb(0.82, 0.87, 0.91)
  const softBlue = rgb(0.92, 0.97, 0.99)
  const softSlate = rgb(0.965, 0.975, 0.985)
  const cols = [
    { key: "full_name", label: "Aluno", width: 176 },
    { key: "presence_count", label: "Pres.", width: 36 },
    { key: "absence_count", label: "Falt.", width: 36 },
    { key: "attendance_percent", label: "Freq.", width: 46 },
    { key: "graded_lessons", label: "Aulas", width: 38 },
    { key: "note1", label: "Nota1", width: 42 },
    { key: "exam_score", label: "Prova", width: 42 },
    { key: "c5_score", label: "C5", width: 34 },
    { key: "note2", label: "Nota2", width: 42 },
    { key: "final_grade", label: "Final", width: 42 },
    { key: "observations", label: "Observações", width: 250 },
  ]

  const totalWidth = cols.reduce((sum, col) => sum + col.width, 0)

  function pdfSafeText(value: unknown) {
    return String(value ?? "")
      .replace(/\r/g, "")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[^\n\t\x20-\x7E\u00A0-\u00FF]/g, "?")
  }

  function textFit(value: string, width: number, useFont = font, size = fontSize) {
    const clean = pdfSafeText(value).replace(/\s+/g, " ").trim()
    if (!clean) return "-"
    if (useFont.widthOfTextAtSize(clean, size) <= width - 6) return clean
    let out = clean
    while (out.length > 1 && useFont.widthOfTextAtSize(`${out}...`, size) > width - 6) {
      out = out.slice(0, -1)
    }
    return `${out}...`
  }

  function wrapPdfText(value: unknown, width: number, size = 8, useFont = font) {
    const paragraphs = pdfSafeText(value).split("\n")
    const lines: string[] = []

    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean)
      if (words.length === 0) {
        lines.push("")
        continue
      }

      let current = ""
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (useFont.widthOfTextAtSize(candidate, size) <= width) {
          current = candidate
          continue
        }
        if (current) lines.push(current)

        if (useFont.widthOfTextAtSize(word, size) <= width) {
          current = word
          continue
        }

        let fragment = ""
        for (const character of word) {
          const fragmentCandidate = `${fragment}${character}`
          if (fragment && useFont.widthOfTextAtSize(fragmentCandidate, size) > width) {
            lines.push(fragment)
            fragment = character
          } else {
            fragment = fragmentCandidate
          }
        }
        current = fragment
      }
      if (current) lines.push(current)
    }

    return lines
  }

  function drawDocumentHeader(
    currentPage: ReturnType<typeof pdf.addPage>,
    title: string,
    section: string,
  ) {
    currentPage.drawRectangle({
      x: 0,
      y: pageSize[1] - 56,
      width: pageSize[0],
      height: 56,
      color: navy,
    })
    currentPage.drawRectangle({
      x: 0,
      y: pageSize[1] - 56,
      width: 7,
      height: 56,
      color: cyan,
    })
    currentPage.drawText("BLUEWORLD9  |  RELATÓRIO ACADÊMICO", {
      x: marginX,
      y: pageSize[1] - 21,
      size: 7.5,
      font: bold,
      color: rgb(0.55, 0.88, 0.95),
    })
    currentPage.drawText(pdfSafeText(title), {
      x: marginX,
      y: pageSize[1] - 42,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    })

    const sectionText = pdfSafeText(section)
    currentPage.drawText(sectionText, {
      x: pageSize[0] - marginX - font.widthOfTextAtSize(sectionText, 8),
      y: pageSize[1] - 22,
      size: 8,
      font,
      color: rgb(0.75, 0.84, 0.9),
    })
    const scopeText = pdfSafeText(`${schoolYear}  |  ${bimester}º bimestre`)
    currentPage.drawText(scopeText, {
      x: pageSize[0] - marginX - bold.widthOfTextAtSize(scopeText, 9),
      y: pageSize[1] - 42,
      size: 9,
      font: bold,
      color: rgb(1, 1, 1),
    })
  }

  function drawSummaryHeader(currentPage: ReturnType<typeof pdf.addPage>, continued = false) {
    drawDocumentHeader(
      currentPage,
      className,
      continued ? "Resumo bimestral - continuação" : "Resumo bimestral",
    )
    currentPage.drawRectangle({
      x: marginX,
      y: topY - 18,
      width: totalWidth,
      height: 18,
      color: blue,
    })
    let x = marginX
    for (const col of cols) {
      currentPage.drawText(col.label, {
        x: x + 3,
        y: topY - 12,
        size: fontSize,
        font: bold,
        color: rgb(1, 1, 1),
      })
      x += col.width
    }
  }

  let page = pdf.addPage(pageSize)
  drawSummaryHeader(page)
  let y = topY - 31

  rows.forEach((row, rowIndex) => {
    if (y < bottomY + rowHeight) {
      page = pdf.addPage(pageSize)
      drawSummaryHeader(page, true)
      y = topY - 31
    }

    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: marginX,
        y: y - 4,
        width: totalWidth,
        height: rowHeight,
        color: softSlate,
      })
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
      const isFinal = col.key === "final_grade"
      page.drawText(textFit(values[col.key], col.width), {
        x: x + 3,
        y,
        size: fontSize,
        font: isFinal ? bold : font,
        color: isFinal ? rgb(0.02, 0.38, 0.5) : ink,
      })
      x += col.width
    }
    y -= rowHeight
  })

  if (rows.length === 0) {
    page.drawText("Nenhum aluno encontrado para este bimestre.", {
      x: marginX,
      y,
      size: 9,
      font,
      color: muted,
    })
  }

  if (includeLessonHistory) {
    let historyPage: ReturnType<typeof pdf.addPage> | null = null
    let historyY = topY
    let activeLesson: LessonHistoryItem | null = null
    let gradeTableActive = false

    const drawLessonBanner = (lesson: LessonHistoryItem, continued = false) => {
      if (!historyPage) return
      const statusText = lesson.has_grades ? "COM AVALIAÇÃO" : "SEM AVALIAÇÃO"
      const bannerColor = lesson.has_grades ? rgb(0.88, 0.97, 0.97) : rgb(0.94, 0.95, 0.97)
      const accentColor = lesson.has_grades ? cyan : rgb(0.48, 0.55, 0.64)

      historyPage.drawRectangle({
        x: marginX,
        y: historyY - 23,
        width: contentWidth,
        height: 23,
        color: bannerColor,
      })
      historyPage.drawRectangle({
        x: marginX,
        y: historyY - 23,
        width: 5,
        height: 23,
        color: accentColor,
      })
      historyPage.drawText(
        pdfSafeText(
          `Aula ${formatLessonNumber(lesson.lesson_number)}${continued ? " - continuação" : ""}`,
        ),
        {
          x: marginX + 11,
          y: historyY - 15,
          size: 10,
          font: bold,
          color: navy,
        },
      )
      const meta = pdfSafeText(`${formatDate(lesson.lesson_date)}  |  ${statusText}`)
      historyPage.drawText(meta, {
        x: pageSize[0] - marginX - bold.widthOfTextAtSize(meta, 7),
        y: historyY - 14,
        size: 7,
        font: bold,
        color: muted,
      })
      historyY -= 29
    }

    const newHistoryPage = (continued = false) => {
      historyPage = pdf.addPage(pageSize)
      drawDocumentHeader(historyPage, className, "Histórico de aulas")
      historyY = topY
      if (continued && activeLesson) drawLessonBanner(activeLesson, true)
    }

    const getHistoryPage = (): ReturnType<typeof pdf.addPage> => {
      if (!historyPage) newHistoryPage()
      return historyPage as ReturnType<typeof pdf.addPage>
    }

    const drawGradeHeader = () => {
      if (!historyPage) return
      const headers = [
        { label: "Aluno", width: 220 },
        { label: "Presença", width: 55 },
        { label: "C1", width: 34 },
        { label: "C2", width: 34 },
        { label: "C3", width: 34 },
        { label: "C4", width: 34 },
        { label: "Média", width: 45 },
        { label: "Observação", width: 328 },
      ]
      historyPage.drawRectangle({
        x: marginX,
        y: historyY - 15,
        width: contentWidth,
        height: 15,
        color: navy,
      })
      let x = marginX
      for (const header of headers) {
        historyPage.drawText(header.label, {
          x: x + 3,
          y: historyY - 10,
          size: 6.7,
          font: bold,
          color: rgb(1, 1, 1),
        })
        x += header.width
      }
      historyY -= 18
    }

    const ensureHistorySpace = (height: number) => {
      if (!historyPage) newHistoryPage()
      if (historyY - height >= bottomY) return
      newHistoryPage(true)
      if (gradeTableActive) drawGradeHeader()
    }

    const drawCompactText = (label: string, value: unknown) => {
      const text = String(value ?? "").trim() || "-"
      const lines = wrapPdfText(`${label}: ${text}`, contentWidth - 14, 7.7)
      for (const line of lines) {
        ensureHistorySpace(10)
        getHistoryPage().drawText(line || " ", {
          x: marginX + 7,
          y: historyY,
          size: 7.7,
          font,
          color: ink,
        })
        historyY -= 9.5
      }
    }

    if (lessonHistory.length === 0) {
      newHistoryPage()
      getHistoryPage().drawRectangle({
        x: marginX,
        y: topY - 54,
        width: contentWidth,
        height: 54,
        color: softBlue,
      })
      getHistoryPage().drawText("Nenhuma aula foi registrada neste bimestre.", {
        x: marginX + 16,
        y: topY - 31,
        size: 10,
        font: bold,
        color: muted,
      })
    }

    for (const lesson of lessonHistory) {
      activeLesson = lesson
      gradeTableActive = false
      if (!historyPage) newHistoryPage()
      if (historyY - (includeLessonGrades ? 76 : 54) < bottomY) newHistoryPage()
      drawLessonBanner(lesson)
      drawCompactText("Diário", lesson.diary_notes)
      drawCompactText("Observações", lesson.observations)
      historyY -= 4

      if (!includeLessonGrades) {
        historyY -= 5
        continue
      }

      if (!lesson.has_grades || lesson.entries.length === 0) {
        ensureHistorySpace(18)
        getHistoryPage().drawRectangle({
          x: marginX,
          y: historyY - 15,
          width: contentWidth,
          height: 15,
          color: softSlate,
        })
        getHistoryPage().drawText(
          lesson.has_grades
            ? "Nenhum lançamento individual registrado."
            : "Aula registrada sem avaliação.",
          {
            x: marginX + 7,
            y: historyY - 10,
            size: 7.5,
            font: italic,
            color: muted,
          },
        )
        historyY -= 24
        continue
      }

      ensureHistorySpace(20)
      drawGradeHeader()
      gradeTableActive = true

      lesson.entries.forEach((entry, entryIndex) => {
        const attendance =
          entry.attendance === "absent"
            ? "Falta"
            : entry.attendance === "present"
              ? "Presente"
              : "Pendente"
        const values = [
          { value: entry.full_name, width: 220 },
          { value: attendance, width: 55 },
          { value: formatScore(reportScoreValue(entry, "c1")), width: 34 },
          { value: formatScore(reportScoreValue(entry, "c2")), width: 34 },
          { value: formatScore(reportScoreValue(entry, "c3")), width: 34 },
          { value: formatScore(reportScoreValue(entry, "c4")), width: 34 },
          { value: formatScore(lessonAverage(entry)), width: 45 },
        ]
        const commentLines = wrapPdfText(
          String(entry.comment ?? "").trim() || "-",
          320,
          7,
        )
        const gradeRowHeight = Math.max(13, commentLines.length * 8 + 5)
        ensureHistorySpace(gradeRowHeight + 2)

        if (entryIndex % 2 === 0) {
          getHistoryPage().drawRectangle({
            x: marginX,
            y: historyY - gradeRowHeight + 2,
            width: contentWidth,
            height: gradeRowHeight,
            color: softSlate,
          })
        }

        let x = marginX
        values.forEach((item, itemIndex) => {
          getHistoryPage().drawText(textFit(item.value, item.width, itemIndex === 6 ? bold : font, 7), {
            x: x + 3,
            y: historyY - 7,
            size: 7,
            font: itemIndex === 6 ? bold : font,
            color: itemIndex === 6 ? rgb(0.02, 0.38, 0.5) : ink,
          })
          x += item.width
        })
        commentLines.forEach((line, lineIndex) => {
          getHistoryPage().drawText(line || " ", {
            x: marginX + 459,
            y: historyY - 7 - lineIndex * 8,
            size: 7,
            font,
            color: ink,
          })
        })
        historyY -= gradeRowHeight
      })
      gradeTableActive = false
      historyY -= 8
    }
  }

  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date())
  const pages = pdf.getPages()
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: marginX, y: 19 },
      end: { x: pageSize[0] - marginX, y: 19 },
      thickness: 0.4,
      color: lineColor,
    })
    currentPage.drawText(pdfSafeText(`Gerado em ${generatedAt}`), {
      x: marginX,
      y: 8,
      size: 6.5,
      font,
      color: muted,
    })
    const pageLabel = `Página ${index + 1} de ${pages.length}`
    currentPage.drawText(pageLabel, {
      x: pageSize[0] - marginX - font.widthOfTextAtSize(pageLabel, 6.5),
      y: 8,
      size: 6.5,
      font,
      color: muted,
    })
  })

  return Buffer.from(await pdf.save())
}

async function buildXlsxBuffer(params: {
  className: string
  schoolYear: number
  bimester: number
  rows: any[]
  lessonHistory?: LessonHistoryItem[]
  includeLessonHistory?: boolean
  includeLessonGrades?: boolean
}) {
  const {
    className,
    schoolYear,
    bimester,
    rows,
    lessonHistory = [],
    includeLessonHistory = false,
    includeLessonGrades = true,
  } = params
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "BlueWorld9"
  workbook.created = new Date()

  const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF06283D" } } as const
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0077A8" } } as const
  const alternateFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F7FA" } } as const
  const thinBorder = {
    bottom: { style: "thin", color: { argb: "FFD7E2E8" } },
  } as const
  const scopeLabel = `${className} | ${schoolYear} | ${bimester}º bimestre`

  function prepareSheet(
    sheet: ExcelJS.Worksheet,
    title: string,
    columns: Array<{ header: string; key: string; width: number }>,
    tabColor: string,
  ) {
    sheet.columns = columns.map(({ key, width }) => ({ key, width }))
    sheet.mergeCells(1, 1, 1, columns.length)
    sheet.getCell(1, 1).value = title
    sheet.getCell(1, 1).fill = titleFill
    sheet.getCell(1, 1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 }
    sheet.getCell(1, 1).alignment = { vertical: "middle" }
    sheet.getRow(1).height = 28

    sheet.mergeCells(2, 1, 2, columns.length)
    sheet.getCell(2, 1).value = scopeLabel
    sheet.getCell(2, 1).font = { bold: true, color: { argb: "FF496675" }, size: 10 }
    sheet.getCell(2, 1).alignment = { vertical: "middle" }
    sheet.getRow(2).height = 20

    const headerRow = sheet.getRow(4)
    headerRow.values = columns.map((column) => column.header)
    headerRow.height = 22
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { vertical: "middle" }
    })

    sheet.views = [{ state: "frozen", ySplit: 4 }]
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } }
    sheet.properties.tabColor = { argb: tabColor }
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    sheet.headerFooter.oddFooter = "BlueWorld9 | Página &P de &N"
  }

  function styleDataRows(sheet: ExcelJS.Worksheet, firstRow = 5) {
    for (let rowNumber = firstRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber)
      row.alignment = { vertical: "top", wrapText: true }
      row.height = Math.max(row.height ?? 18, 18)
      row.eachCell((cell) => {
        cell.border = thinBorder
        if ((rowNumber - firstRow) % 2 === 0) cell.fill = alternateFill
      })
    }
  }

  const worksheet = workbook.addWorksheet("Notas")
  const summaryColumns = [
    { header: "Aluno", key: "full_name", width: 34 },
    { header: "Presenças", key: "presence_count", width: 10 },
    { header: "Faltas", key: "absence_count", width: 9 },
    { header: "Frequência", key: "attendance_percent", width: 12 },
    { header: "Aulas avaliadas", key: "graded_lessons", width: 14 },
    { header: "Nota 1", key: "note1", width: 10 },
    { header: "Prova/Atividade", key: "exam_score", width: 14 },
    { header: "C5", key: "c5_score", width: 8 },
    { header: "Nota 2", key: "note2", width: 10 },
    { header: "Nota Final", key: "final_grade", width: 12 },
    { header: "Observações", key: "observations", width: 44 },
  ]
  prepareSheet(worksheet, "Resumo bimestral de notas", summaryColumns, "FF00B8C4")

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
  styleDataRows(worksheet)
  for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    worksheet.getCell(rowNumber, 10).font = { bold: true, color: { argb: "FF00738A" } }
  }

  if (includeLessonHistory) {
    const historySheet = workbook.addWorksheet("Histórico de aulas")
    const historyColumns = [
      { header: "Aula", key: "lesson_number", width: 10 },
      { header: "Data", key: "lesson_date", width: 13 },
      { header: "Possui notas", key: "has_grades", width: 14 },
      { header: "Diário da aula", key: "diary_notes", width: 64 },
      { header: "Observações gerais", key: "observations", width: 64 },
      ...(includeLessonGrades
        ? [{ header: "Alunos no registro", key: "students_count", width: 18 }]
        : []),
    ]
    prepareSheet(historySheet, "Histórico de aulas", historyColumns, "FF2A9D8F")

    for (const lesson of lessonHistory) {
      historySheet.addRow({
        lesson_number: `Aula ${formatLessonNumber(lesson.lesson_number)}`,
        lesson_date: formatDate(lesson.lesson_date),
        has_grades: lesson.has_grades ? "Sim" : "Não",
        diary_notes: String(lesson.diary_notes ?? ""),
        observations: String(lesson.observations ?? ""),
        students_count: lesson.entries.length,
      })
    }
    styleDataRows(historySheet)

    if (includeLessonGrades) {
      const entriesSheet = workbook.addWorksheet("Notas por aula")
      const entryColumns = [
        { header: "Aula", key: "lesson_number", width: 12 },
        { header: "Data", key: "lesson_date", width: 13 },
        { header: "Aluno", key: "full_name", width: 34 },
        { header: "Presença", key: "attendance", width: 13 },
        { header: "C1", key: "c1", width: 9 },
        { header: "C2", key: "c2", width: 9 },
        { header: "C3", key: "c3", width: 9 },
        { header: "C4", key: "c4", width: 9 },
        { header: "Média da aula", key: "lesson_average", width: 15 },
        { header: "Observação do aluno", key: "comment", width: 54 },
      ]
      prepareSheet(entriesSheet, "Notas por aula", entryColumns, "FFF4A261")

      for (const lesson of lessonHistory) {
        if (!lesson.has_grades || lesson.entries.length === 0) continue
        for (const entry of lesson.entries) {
          entriesSheet.addRow({
            lesson_number: `Aula ${formatLessonNumber(lesson.lesson_number)}`,
            lesson_date: formatDate(lesson.lesson_date),
            full_name: entry.full_name,
            attendance:
              entry.attendance === "absent"
                ? "Falta"
                : entry.attendance === "present"
                  ? "Presente"
                  : "Não lançada",
            c1: reportScoreValue(entry, "c1") ?? "",
            c2: reportScoreValue(entry, "c2") ?? "",
            c3: reportScoreValue(entry, "c3") ?? "",
            c4: reportScoreValue(entry, "c4") ?? "",
            lesson_average: lessonAverage(entry) ?? "",
            comment: String(entry.comment ?? ""),
          })
        }
      }
      styleDataRows(entriesSheet)
      for (let rowNumber = 5; rowNumber <= entriesSheet.rowCount; rowNumber += 1) {
        entriesSheet.getCell(rowNumber, 9).font = { bold: true, color: { argb: "FF00738A" } }
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherPermissionApi("agenda_notas")
  if (!auth.ok) return auth.response

  if (auth.teacher.can_download === false) {
    return NextResponse.json({ error: "Downloads não permitidos para este acesso." }, { status: 403 })
  }

  await ensureGradebookSchema()

  const resolved = await ctx.params
  const classId = String(resolved?.id ?? "").trim()
  const search = new URL(req.url).searchParams
  const format = String(search.get("format") ?? "xlsx").trim().toLowerCase()
  const report = String(search.get("report") ?? "grades").trim().toLowerCase() as ExportReport
  const includeLessonGrades = search.get("includeLessonGrades") !== "0"
  const bimester = normalizeBimester(search.get("bimester"))
  const schoolYear = normalizeSchoolYear(search.get("schoolYear"))
  const isAdmin = isAdminUser(auth.teacher)

  if (!isUuid(classId)) {
    return NextResponse.json({ error: "Turma inválida" }, { status: 400 })
  }
  if (bimester === null) {
    return NextResponse.json({ error: "Bimestre inválido" }, { status: 400 })
  }
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo inválido" }, { status: 400 })
  }
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Formato inválido. Use xlsx ou pdf." }, { status: 400 })
  }
  if (report !== "grades" && report !== "complete") {
    return NextResponse.json({ error: "Tipo de relatório inválido." }, { status: 400 })
  }

  const classRow = await loadClassByScope({
    classId,
    teacherId: auth.teacherId,
    isAdmin,
  })
  if (!classRow) {
    return NextResponse.json({ error: "Turma não encontrada" }, { status: 404 })
  }

  const isPyScoreScale = getScoreMaxByCountry(classRow.teacher_country ?? auth.teacher.country) <= 5
  const rows = await loadExportRows({
    classId,
    bimester,
    schoolYear,
    isPyScoreScale,
  })
  const lessonHistory = report === "complete"
    ? await loadLessonHistory({
        classId,
        bimester,
        schoolYear,
        includeLessonGrades,
      })
    : []

  const filenameBase = `${safeFilenamePart(String(classRow.name ?? "turma"))}-B${bimester}-${schoolYear}${
    report === "complete" ? "-relatorio-completo" : ""
  }`

  if (format === "xlsx") {
    const buffer = await buildXlsxBuffer({
      className: String(classRow.name ?? "Turma"),
      schoolYear,
      bimester,
      rows,
      lessonHistory,
      includeLessonHistory: report === "complete",
      includeLessonGrades,
    })

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
    lessonHistory,
    includeLessonHistory: report === "complete",
    includeLessonGrades,
  })

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  })
}
