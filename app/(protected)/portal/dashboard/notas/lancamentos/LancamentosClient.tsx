"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  Pencil,
  RefreshCcw,
  Save,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  TeacherClass,
  TeacherClassStudent,
  TeacherGradeLesson,
  TeacherGradeLessonEntry,
  TeacherLessonLog,
  TeacherSchedule,
} from "@/app/types/portal"
import { formatDatePtBr } from "@/lib/format-date"
import { getTurmaYearLabel } from "@/lib/turma-years"
import NotasSectionNav from "../_components/NotasSectionNav"

type Locale = "pt-BR" | "es"
type WorkspaceTab = "agenda" | "lancamentos" | "turmas"
type ShiftPeriod = "morning" | "afternoon"
type ScoreField = "c1" | "c2" | "c3" | "c4"
type TurmaScoreField = "exam_score" | "c5_score" | "manual_final_score"

type TurmaSummaryRow = {
  student_id: string
  full_name: string
  graded_lessons: number
  presence_count: number
  absence_count: number
  note1: number | null
}

type TurmaGradeFormItem = {
  exam_score: string
  c5_score: string
  manual_final_score: string
  notes: string
}

type StudentInsightModalData = {
  class: {
    id: string
    name: string
    school_year: number
    student_year: number | null
    active: boolean
  }
  student: {
    id: string
    full_name: string
    enrollment_code: string | null
    active: boolean
  }
  totals: {
    entries_count: number
    presence_count: number
    absence_count: number
    attendance_percent: number | null
  }
  bimesters: Array<{
    bimester: number
    entries_count: number
    graded_lessons: number
    presence_count: number
    absence_count: number
    note1: number | null
    exam_score: number | null
    c5_score: number | null
    note2: number | null
    manual_final_score: number | null
    final_grade: number | null
    notes: string | null
    updated_at: string | null
  }>
  lessons: Array<{
    lesson_id: string
    bimester: number
    lesson_number: number
    lesson_date: string
    lesson_notes: string | null
    attendance: "present" | "absent" | null
    c1: number | null
    c2: number | null
    c3: number | null
    c4: number | null
    lesson_average: number | null
    comment: string | null
  }>
}

type QuickLaunchSnapshotData = {
  lessonDate: string
  bimester: number
  hasGrades: boolean
  notes: string
  observations: string
  entries: Array<{
    student_id: string
    attendance: "present" | "absent" | null
    c1: number | null
    c2: number | null
    c3: number | null
    c4: number | null
    comment: string | null
  }>
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeLessonDate(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return todayIsoDate()

  const justDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (justDate) return justDate[1]

  const isoWithTime = raw.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (isoWithTime) return isoWithTime[1]

  return todayIsoDate()
}

function parseNumericInput(value: string, max = 10) {
  const clean = value.replace(",", ".").trim()
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(max, Math.round(n * 100) / 100))
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function timeToMinutes(value: string) {
  const [hRaw, mRaw] = String(value ?? "").split(":")
  const h = Number(hRaw ?? 0)
  const m = Number(mRaw ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return Math.max(0, h * 60 + m)
}

function getShiftPeriod(startTime: string): ShiftPeriod {
  return timeToMinutes(startTime) < 12 * 60 ? "morning" : "afternoon"
}

function normalizeClassLabel(value: string) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR")
}

function inferBimesterFromDate(value: string | null | undefined) {
  const raw = normalizeLessonDate(String(value ?? ""))
  const month = Number(raw.slice(5, 7))
  if (!Number.isFinite(month)) return 1
  if (month >= 1 && month <= 3) return 1
  if (month >= 4 && month <= 6) return 2
  if (month >= 7 && month <= 9) return 3
  return 4
}

function previewText(value: string | null | undefined, max = 120) {
  const clean = String(value ?? "").trim()
  if (!clean) return ""
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}...`
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function displayScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return Number(value).toFixed(2)
}

function calcNote2(exam: number | null, c5: number | null, isPyScoreScale: boolean) {
  if (exam === null || c5 === null) return null
  const value = isPyScoreScale ? (exam + c5) / 2 : exam + c5
  return Math.round(value * 100) / 100
}

function buildQuickLaunchSnapshot(data: QuickLaunchSnapshotData) {
  return JSON.stringify({
    lessonDate: normalizeLessonDate(data.lessonDate),
    bimester: Number(data.bimester),
    hasGrades: data.hasGrades !== false,
    notes: String(data.notes ?? "").trim(),
    observations: String(data.observations ?? "").trim(),
    entries: data.entries.map((entry) => ({
      student_id: String(entry.student_id ?? ""),
      attendance: entry.attendance === "absent" ? "absent" : "present",
      c1: entry.c1 ?? null,
      c2: entry.c2 ?? null,
      c3: entry.c3 ?? null,
      c4: entry.c4 ?? null,
      comment: String(entry.comment ?? "").trim() || null,
    })),
  })
}

function getQuickLaunchDirtyText(locale: Locale) {
  return locale === "es"
    ? "Hay cambios sin guardar. ¿Desea guardar antes de cerrar?"
    : "Voce tem alteracoes sem salvar. Deseja salvar antes de fechar?"
}

function getQuickLaunchDiscardText(locale: Locale) {
  return locale === "es"
    ? "¿Desea cerrar sin guardar?"
    : "Deseja fechar sem salvar?"
}

function getQuickLaunchUnloadText(locale: Locale) {
  return locale === "es"
    ? "Hay cambios sin guardar en el lanzamiento de clase."
    : "Ha alteracoes sem salvar no lancamento da aula."
}

const note2ComponentMax = 5

function parseNote2Component(value: string) {
  return parseNumericInput(value, note2ComponentMax)
}

function buildAutoFinalInputValue(
  manualFinalRaw: string,
  note1: number | null,
  note2: number | null,
  scoreMax: number,
) {
  const manualFinal = parseNumericInput(manualFinalRaw, scoreMax)
  if (manualFinal !== null) return String(manualFinal)
  const calculated = calcFinal(note1, note2)
  return calculated === null ? "" : String(calculated)
}

function calcFinalForSave(
  manualFinalRaw: string,
  note1: number | null,
  note2: number | null,
  scoreMax: number,
) {
  const manualFinal = parseNumericInput(manualFinalRaw, scoreMax)
  if (manualFinal !== null) return manualFinal
  return calcFinal(note1, note2)
}

function calcFinal(note1: number | null, note2: number | null) {
  if (note1 === null || note2 === null) return null
  return Math.round(((note1 + note2) / 2) * 100) / 100
}

const scoreInputClass =
  "h-7 w-14 md:w-16 bg-slate-800/80 border-slate-700 text-white text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
const scoreFieldOrder: ScoreField[] = ["c1", "c2", "c3", "c4"]
const turmaScoreFieldOrder: TurmaScoreField[] = ["exam_score", "c5_score", "manual_final_score"]

export default function LancamentosClient({
  locale,
  scoreMax = 10,
}: {
  locale: Locale
  scoreMax?: number
}) {
  const isEs = locale === "es"
  const isPyScoreScale = scoreMax <= 5
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("agenda")

  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear())
  const [bimester, setBimester] = useState(1)

  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [lessonLogs, setLessonLogs] = useState<TeacherLessonLog[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [lessons, setLessons] = useState<TeacherGradeLesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState("")
  const [entries, setEntries] = useState<TeacherGradeLessonEntry[]>([])
  const [lessonDate, setLessonDate] = useState(todayIsoDate())
  const [lessonHasGrades, setLessonHasGrades] = useState(true)
  const [lessonNotes, setLessonNotes] = useState("")
  const [openLogGroups, setOpenLogGroups] = useState<Record<string, boolean>>({})
  const [viewingLog, setViewingLog] = useState<
    | {
        id: string
        class_label: string
        lesson_number: number
        bimester: number
        lesson_date: string
        notes: string
        observations: string
      }
    | null
  >(null)
  const [editingLog, setEditingLog] = useState<
    | {
        id: string
        class_label: string
        lesson_number: number
        bimester: number
        lesson_date: string
        notes: string
        observations: string
      }
    | null
  >(null)
  const [quickLaunchSchedule, setQuickLaunchSchedule] = useState<TeacherSchedule | null>(null)
  const [quickLaunchOpen, setQuickLaunchOpen] = useState(false)
  const [quickLaunchLoadingStudents, setQuickLaunchLoadingStudents] = useState(false)
  const [quickLaunchSaving, setQuickLaunchSaving] = useState(false)
  const [quickLaunchDate, setQuickLaunchDate] = useState(todayIsoDate())
  const [quickLaunchBimester, setQuickLaunchBimester] = useState(1)
  const [quickLaunchHasGrades, setQuickLaunchHasGrades] = useState(true)
  const [quickLaunchNotes, setQuickLaunchNotes] = useState("")
  const [quickLaunchObservations, setQuickLaunchObservations] = useState("")
  const [quickLaunchEntries, setQuickLaunchEntries] = useState<TeacherGradeLessonEntry[]>([])
  const lessonScoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [lessonModalOpen, setLessonModalOpen] = useState(false)
  const [lessonModalLoading, setLessonModalLoading] = useState(false)
  const quickLaunchScoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const quickLaunchInitialSnapshotRef = useRef("")
  const [turmaRows, setTurmaRows] = useState<TurmaSummaryRow[]>([])
  const [turmaGradeForm, setTurmaGradeForm] = useState<Record<string, TurmaGradeFormItem>>({})
  const turmaScoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [turmaLoading, setTurmaLoading] = useState(false)
  const [turmaSaving, setTurmaSaving] = useState(false)
  const [turmaClosed, setTurmaClosed] = useState(false)
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false)
  const [studentDetailsModal, setStudentDetailsModal] = useState<StudentInsightModalData | null>(null)
  const [exportingFormat, setExportingFormat] = useState<"" | "xlsx" | "pdf">("")
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<"" | "xlsx" | "pdf">("")
  const [exportBimesterChoice, setExportBimesterChoice] = useState(1)
  const [resolvingClassBimester, setResolvingClassBimester] = useState(false)
  const autoBimesterKeyRef = useRef("")

  const quickLaunchSnapshotNow = useMemo(
    () =>
      buildQuickLaunchSnapshot({
        lessonDate: quickLaunchDate,
        bimester: quickLaunchBimester,
        hasGrades: quickLaunchHasGrades,
        notes: quickLaunchNotes,
        observations: quickLaunchObservations,
        entries: quickLaunchEntries.map((entry) => ({
          student_id: entry.student_id,
          attendance: entry.attendance ?? null,
          c1: entry.c1 ?? null,
          c2: entry.c2 ?? null,
          c3: entry.c3 ?? null,
          c4: entry.c4 ?? null,
          comment: entry.comment ?? null,
        })),
      }),
    [
      quickLaunchDate,
      quickLaunchBimester,
      quickLaunchHasGrades,
      quickLaunchNotes,
      quickLaunchObservations,
      quickLaunchEntries,
    ],
  )

  const hasQuickLaunchChanges =
    quickLaunchOpen &&
    quickLaunchInitialSnapshotRef.current !== "" &&
    quickLaunchSnapshotNow !== quickLaunchInitialSnapshotRef.current

  useEffect(() => {
    if (!hasQuickLaunchChanges) return
    const message = getQuickLaunchUnloadText(locale)
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
      return message
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasQuickLaunchChanges, locale])

  function quickLaunchScoreRefKey(studentId: string, field: ScoreField) {
    return `${studentId}:${field}`
  }

  function setQuickLaunchScoreInputRef(studentId: string, field: ScoreField, el: HTMLInputElement | null) {
    quickLaunchScoreInputRefs.current[quickLaunchScoreRefKey(studentId, field)] = el
  }

  function focusQuickLaunchScoreCell(rowIndex: number, field: ScoreField) {
    const row = quickLaunchEntries[rowIndex]
    if (!row) return
    const input = quickLaunchScoreInputRefs.current[quickLaunchScoreRefKey(row.student_id, field)]
    input?.focus()
    input?.select()
  }

  function handleQuickLaunchScoreKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: ScoreField,
  ) {
    const colIndex = scoreFieldOrder.indexOf(field)
    if (colIndex < 0) return

    let targetRow = rowIndex
    let targetCol = colIndex

    if (event.key === "Enter" || event.key === "ArrowRight") {
      if (colIndex < scoreFieldOrder.length - 1) {
        targetCol = colIndex + 1
      } else if (rowIndex < quickLaunchEntries.length - 1) {
        targetRow = rowIndex + 1
        targetCol = 0
      } else {
        return
      }
    } else if (event.key === "ArrowLeft") {
      if (colIndex > 0) {
        targetCol = colIndex - 1
      } else if (rowIndex > 0) {
        targetRow = rowIndex - 1
        targetCol = scoreFieldOrder.length - 1
      } else {
        return
      }
    } else if (event.key === "ArrowDown") {
      if (rowIndex >= quickLaunchEntries.length - 1) return
      targetRow = rowIndex + 1
    } else if (event.key === "ArrowUp") {
      if (rowIndex <= 0) return
      targetRow = rowIndex - 1
    } else {
      return
    }

    event.preventDefault()
    focusQuickLaunchScoreCell(targetRow, scoreFieldOrder[targetCol])
  }

  function lessonScoreRefKey(studentId: string, field: ScoreField) {
    return `${studentId}:${field}`
  }

  function setLessonScoreInputRef(studentId: string, field: ScoreField, el: HTMLInputElement | null) {
    lessonScoreInputRefs.current[lessonScoreRefKey(studentId, field)] = el
  }

  function focusLessonScoreCell(rowIndex: number, field: ScoreField) {
    const row = entries[rowIndex]
    if (!row) return
    const input = lessonScoreInputRefs.current[lessonScoreRefKey(row.student_id, field)]
    input?.focus()
    input?.select()
  }

  function handleLessonScoreKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: ScoreField,
  ) {
    const colIndex = scoreFieldOrder.indexOf(field)
    if (colIndex < 0) return

    let targetRow = rowIndex
    let targetCol = colIndex

    if (event.key === "Enter" || event.key === "ArrowRight") {
      if (colIndex < scoreFieldOrder.length - 1) {
        targetCol = colIndex + 1
      } else if (rowIndex < entries.length - 1) {
        targetRow = rowIndex + 1
        targetCol = 0
      } else {
        return
      }
    } else if (event.key === "ArrowLeft") {
      if (colIndex > 0) {
        targetCol = colIndex - 1
      } else if (rowIndex > 0) {
        targetRow = rowIndex - 1
        targetCol = scoreFieldOrder.length - 1
      } else {
        return
      }
    } else if (event.key === "ArrowDown") {
      if (rowIndex >= entries.length - 1) return
      targetRow = rowIndex + 1
    } else if (event.key === "ArrowUp") {
      if (rowIndex <= 0) return
      targetRow = rowIndex - 1
    } else {
      return
    }

    event.preventDefault()
    focusLessonScoreCell(targetRow, scoreFieldOrder[targetCol])
  }

  function turmaScoreRefKey(studentId: string, field: TurmaScoreField) {
    return `${studentId}:${field}`
  }

  function setTurmaScoreInputRef(studentId: string, field: TurmaScoreField, el: HTMLInputElement | null) {
    turmaScoreInputRefs.current[turmaScoreRefKey(studentId, field)] = el
  }

  function focusTurmaScoreCell(rowIndex: number, field: TurmaScoreField) {
    const row = turmaRows[rowIndex]
    if (!row) return
    const input = turmaScoreInputRefs.current[turmaScoreRefKey(row.student_id, field)]
    input?.focus()
    input?.select()
  }

  function handleTurmaScoreKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: TurmaScoreField,
  ) {
    const colIndex = turmaScoreFieldOrder.indexOf(field)
    if (colIndex < 0) return

    let targetRow = rowIndex
    let targetCol = colIndex

    if (event.key === "Enter" || event.key === "ArrowRight") {
      if (colIndex < turmaScoreFieldOrder.length - 1) {
        targetCol = colIndex + 1
      } else if (rowIndex < turmaRows.length - 1) {
        targetRow = rowIndex + 1
        targetCol = 0
      } else {
        return
      }
    } else if (event.key === "ArrowLeft") {
      if (colIndex > 0) {
        targetCol = colIndex - 1
      } else if (rowIndex > 0) {
        targetRow = rowIndex - 1
        targetCol = turmaScoreFieldOrder.length - 1
      } else {
        return
      }
    } else if (event.key === "ArrowDown") {
      if (rowIndex >= turmaRows.length - 1) return
      targetRow = rowIndex + 1
    } else if (event.key === "ArrowUp") {
      if (rowIndex <= 0) return
      targetRow = rowIndex - 1
    } else {
      return
    }

    event.preventDefault()
    focusTurmaScoreCell(targetRow, turmaScoreFieldOrder[targetCol])
  }

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  )

  const selectedLesson = useMemo(
    () => lessons.find((item) => item.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )

  const orderedLessons = useMemo(
    () =>
      [...lessons].sort((a, b) => {
        const lessonDiff = Number(b.lesson_number ?? 0) - Number(a.lesson_number ?? 0)
        if (lessonDiff !== 0) return lessonDiff
        return String(b.lesson_date ?? "").localeCompare(String(a.lesson_date ?? ""))
      }),
    [lessons],
  )

  const weekdayOptions = useMemo(
    () =>
      isEs
        ? [
            { value: 1, short: "Lun", full: "Lunes" },
            { value: 2, short: "Mar", full: "Martes" },
            { value: 3, short: "Mié", full: "Miércoles" },
            { value: 4, short: "Jue", full: "Jueves" },
            { value: 5, short: "Vie", full: "Viernes" },
          ]
        : [
            { value: 1, short: "Seg", full: "Segunda-feira" },
            { value: 2, short: "Ter", full: "Terça-feira" },
            { value: 3, short: "Qua", full: "Quarta-feira" },
            { value: 4, short: "Qui", full: "Quinta-feira" },
            { value: 5, short: "Sex", full: "Sexta-feira" },
          ],
    [isEs],
  )

  const recurringByWeekday = useMemo(() => {
    const map: Record<number, TeacherSchedule[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }
    for (const item of schedules) {
      if (item.is_recurring === false) continue
      if (!map[item.weekday]) continue
      map[item.weekday].push(item)
    }
    for (const weekday of Object.keys(map)) {
      map[Number(weekday)].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
    }
    return map
  }, [schedules])

  const oneOffEvents = useMemo(() => {
    return schedules
      .filter((item) => item.is_recurring === false)
      .sort((a, b) => {
        const dateCompare = String(a.event_date ?? "").localeCompare(String(b.event_date ?? ""))
        if (dateCompare !== 0) return dateCompare
        return timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      })
      .slice(0, 8)
  }, [schedules])

  const lessonSummaryByClass = useMemo(() => {
    type Summary = {
      count: number
      latestDate: string | null
      latestLessonNumber: number | null
      latestBimester: number | null
    }

    const byClassId = new Map<string, Summary>()
    const byClassLabel = new Map<string, Summary>()

    function upsert(target: Map<string, Summary>, key: string, log: TeacherLessonLog) {
      if (!key) return
      const current = target.get(key) ?? {
        count: 0,
        latestDate: null,
        latestLessonNumber: null,
        latestBimester: null,
      }
      current.count += 1
      const logDate = String(log.lesson_date ?? "")
      const logBimester =
        typeof log.bimester === "number" && log.bimester >= 1 && log.bimester <= 4
          ? log.bimester
          : inferBimesterFromDate(log.lesson_date)
      const shouldUpdateDate = !current.latestDate || logDate > current.latestDate
      if (shouldUpdateDate) {
        current.latestDate = logDate
        current.latestLessonNumber = Number(log.lesson_number ?? 0) || null
        current.latestBimester = logBimester
      } else if (current.latestDate === logDate) {
        const lessonNumber = Number(log.lesson_number ?? 0)
        if (!current.latestLessonNumber || lessonNumber > current.latestLessonNumber) {
          current.latestLessonNumber = lessonNumber
          current.latestBimester = logBimester
        }
      }
      target.set(key, current)
    }

    for (const log of lessonLogs) {
      const classIdKey = String(log.class_id ?? "").trim()
      if (classIdKey) upsert(byClassId, classIdKey, log)
      const classLabelKey = normalizeClassLabel(log.class_label)
      if (classLabelKey) upsert(byClassLabel, classLabelKey, log)
    }

    return { byClassId, byClassLabel }
  }, [lessonLogs])

  const groupedLessonLogs = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; items: TeacherLessonLog[] }
    >()

    const sorted = [...lessonLogs].sort((a, b) => {
      const da = String(a.lesson_date ?? "")
      const db = String(b.lesson_date ?? "")
      const dateCompare = db.localeCompare(da)
      if (dateCompare !== 0) return dateCompare
      return Number(b.lesson_number ?? 0) - Number(a.lesson_number ?? 0)
    })

    for (const log of sorted) {
      const key = String(log.class_id ?? log.class_label ?? "sem-turma")
      const label = String(log.class_label ?? "").trim() || (isEs ? "Turma" : "Turma")
      const existing = groups.get(key) ?? { key, label, items: [] }
      existing.items.push(log)
      groups.set(key, existing)
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    )
  }, [lessonLogs, isEs])

  async function loadClasses(targetYear = schoolYear) {
    const res = await fetch(`/api/portal/gradebook/classes?schoolYear=${targetYear}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => [])
    const list: TeacherClass[] = Array.isArray(data) ? data : []
    setClasses(list)
    setSelectedClassId((prev) => {
      if (prev && list.some((item) => item.id === prev)) return prev
      return list[0]?.id ?? ""
    })
  }

  async function loadSchedules() {
    const res = await fetch("/api/portal/teacher-schedules", { cache: "no-store" })
    const data = await res.json().catch(() => [])
    setSchedules(Array.isArray(data) ? data : [])
  }

  async function loadLessonLogs() {
    const res = await fetch("/api/portal/lesson-logs", { cache: "no-store" })
    const data = await res.json().catch(() => [])
    setLessonLogs(Array.isArray(data) ? data : [])
  }

  async function loadLessons(
    classId: string,
    options?: { bimester?: number; schoolYear?: number },
  ) {
    if (!classId) {
      setLessons([])
      setSelectedLessonId("")
      return [] as TeacherGradeLesson[]
    }
    const targetBimester = options?.bimester ?? bimester
    const targetSchoolYear = options?.schoolYear ?? schoolYear
    const res = await fetch(
      `/api/portal/gradebook/lessons?classId=${classId}&bimester=${targetBimester}&schoolYear=${targetSchoolYear}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => [])
    const list: TeacherGradeLesson[] = Array.isArray(data) ? data : []
    setLessons(list)
    setSelectedLessonId((prev) => {
      if (prev && list.some((item) => item.id === prev)) return prev
      return list[0]?.id ?? ""
    })
    return list
  }

  async function loadLessonDetail(lessonId: string) {
    if (!lessonId) {
      setEntries([])
      setLessonDate(todayIsoDate())
      setLessonHasGrades(true)
      setLessonNotes("")
      setLessonModalLoading(false)
      return
    }
    setLessonModalLoading(true)
    try {
      const res = await fetch(`/api/portal/gradebook/lessons/${lessonId}`, {
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      setEntries(Array.isArray(data?.entries) ? data.entries : [])
      setLessonDate(normalizeLessonDate(String(data?.lesson?.lesson_date ?? "")))
      setLessonHasGrades(data?.lesson?.has_grades === false ? false : true)
      setLessonNotes(String(data?.lesson?.notes ?? ""))
    } finally {
      setLessonModalLoading(false)
    }
  }

  function openLessonFromList(lessonId: string) {
    if (!lessonId) return
    setError("")
    setSelectedLessonId(lessonId)
    setWorkspaceTab("lancamentos")
    setLessonModalOpen(true)
  }

  function clampTurmaField(
    studentId: string,
    field: "exam_score" | "c5_score" | "manual_final_score",
    max = scoreMax,
  ) {
    setTurmaGradeForm((prev) => {
      const current = prev[studentId]
      if (!current) return prev
      const clamped = parseNumericInput(current[field], max)
      const nextValue = clamped === null ? "" : String(clamped)
      if (current[field] === nextValue) return prev
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: nextValue,
        },
      }
    })
  }

  function resolveNextOpenBimesterFromScope(
    scope: any,
    fallbackCurrentBimester: number,
  ) {
    const current = Number(scope?.bimester ?? fallbackCurrentBimester)
    const bimesterItems = Array.isArray(scope?.bimesters) ? scope.bimesters : []
    const normalized = bimesterItems
      .map((item: any) => ({
        bimester: Number(item?.bimester ?? 0),
        closed: item?.closed === true,
      }))
      .filter((item: any) => Number.isFinite(item.bimester) && item.bimester >= 1 && item.bimester <= 4)
      .sort((a: any, b: any) => a.bimester - b.bimester)

    const openAfter = normalized.find((item: any) => item.bimester > current && item.closed === false)
    if (openAfter) return openAfter.bimester

    const openAny = normalized.find((item: any) => item.closed === false)
    if (openAny) return openAny.bimester

    const recommended = Number(scope?.recommended_bimester ?? 0)
    if (Number.isFinite(recommended) && recommended >= 1 && recommended <= 4) return recommended

    return current
  }

  async function loadTurmaSummary(
    classId: string,
    options?: { autoSwitchClosed?: boolean },
  ) {
    if (!classId) {
      setTurmaRows([])
      setTurmaGradeForm({})
      setTurmaClosed(false)
      return
    }

    setTurmaLoading(true)
    try {
      const [summaryRes, gradesRes] = await Promise.all([
        fetch(`/api/portal/gradebook/summary?classId=${classId}&bimester=${bimester}&schoolYear=${schoolYear}`, {
          cache: "no-store",
        }),
        fetch(`/api/portal/gradebook/bimester-grades?classId=${classId}&bimester=${bimester}&schoolYear=${schoolYear}`, {
          cache: "no-store",
        }),
      ])

      const summaryData = await summaryRes.json().catch(() => ({}))
      const gradesData = await gradesRes.json().catch(() => [])

      if (!summaryRes.ok) {
        throw new Error(String(summaryData?.error ?? "Erro ao carregar resumo da turma."))
      }
      if (!gradesRes.ok) {
        throw new Error(String((gradesData as any)?.error ?? "Erro ao carregar notas da turma."))
      }

      const scope = summaryData?.scope ?? {}
      const isClosed = scope?.closed === true
      setTurmaClosed(isClosed)

      if (isClosed && options?.autoSwitchClosed !== false) {
        const nextOpenBimester = resolveNextOpenBimesterFromScope(scope, bimester)
        if (nextOpenBimester !== bimester) {
          setBimester(nextOpenBimester)
          return
        }
      }

      const summaryRowsRaw = Array.isArray(summaryData?.students) ? summaryData.students : []
      const nextRows: TurmaSummaryRow[] = summaryRowsRaw.map((row: any) => ({
        student_id: String(row?.student_id ?? ""),
        full_name: String(row?.full_name ?? ""),
        graded_lessons: Number(row?.graded_lessons ?? 0),
        presence_count: Number(row?.presence_count ?? 0),
        absence_count: Number(row?.absence_count ?? 0),
        note1: toNumber(row?.note1),
      }))

      const formMap: Record<string, TurmaGradeFormItem> = {}
      const gradeRows = Array.isArray(gradesData) ? gradesData : []
      for (const row of gradeRows as any[]) {
        const studentId = String(row?.student_id ?? "")
        if (!studentId) continue
        formMap[studentId] = {
          exam_score: row?.exam_score === null || row?.exam_score === undefined ? "" : String(row.exam_score),
          c5_score: row?.c5_score === null || row?.c5_score === undefined ? "" : String(row.c5_score),
          manual_final_score:
            row?.manual_final_score === null || row?.manual_final_score === undefined
              ? ""
              : String(row.manual_final_score),
          notes: String(row?.notes ?? ""),
        }
      }

      for (const row of nextRows) {
        if (!formMap[row.student_id]) {
          formMap[row.student_id] = {
            exam_score: "",
            c5_score: "",
            manual_final_score: "",
            notes: "",
          }
        }
      }

      setTurmaRows(nextRows)
      setTurmaGradeForm(formMap)
    } finally {
      setTurmaLoading(false)
    }
  }

  async function saveTurmaGrades() {
    if (!selectedClassId) return
    if (turmaClosed) {
      setError(isEs ? "Bimestre cerrado. No se puede editar." : "Bimestre fechado. Nao e possivel editar.")
      return
    }

    const hasMissingExam = turmaRows.some((row) => {
      const form = turmaGradeForm[row.student_id]
      if (!form) return true
      return parseNote2Component(form.exam_score) === null
    })

    if (hasMissingExam) {
      setError(
        isEs
          ? "Campo Prueba/Actividad es obligatorio para todos."
          : "Campo Prova/Atividade e obrigatorio para todos.",
      )
      return
    }

    setTurmaSaving(true)
    setError("")
    const payload = turmaRows.map((row) => {
      const form = turmaGradeForm[row.student_id] ?? {
        exam_score: "",
        c5_score: "",
        manual_final_score: "",
        notes: "",
      }
      return {
        student_id: row.student_id,
        has_exam: true,
        exam_score: parseNote2Component(form.exam_score),
        c5_score: parseNote2Component(form.c5_score),
        manual_final_score: calcFinalForSave(
          form.manual_final_score,
          toNumber(row.note1),
          calcNote2(parseNote2Component(form.exam_score), parseNote2Component(form.c5_score), isPyScoreScale),
          scoreMax,
        ),
        notes: String(form.notes ?? "").trim() || null,
      }
    })

    const res = await fetch("/api/portal/gradebook/bimester-grades", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: selectedClassId,
        school_year: schoolYear,
        bimester,
        grades: payload,
      }),
    })
    const data = await res.json().catch(() => null)
    setTurmaSaving(false)

    if (!res.ok) {
      setError(String(data?.error ?? (isEs ? "No se pudo guardar." : "Nao foi possivel salvar.")))
      return
    }

    await loadTurmaSummary(selectedClassId, { autoSwitchClosed: true })
  }

  async function openStudentDetails(studentId: string) {
    if (!selectedClassId || !studentId) return

    setStudentDetailsLoading(true)
    setError("")
    const res = await fetch(
      `/api/portal/gradebook/classes/${selectedClassId}/students/${studentId}/insights?schoolYear=${schoolYear}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => null)
    setStudentDetailsLoading(false)

    if (!res.ok) {
      setError(String(data?.error ?? (isEs ? "No se pudo cargar detalles." : "Nao foi possivel carregar detalhes.")))
      return
    }

    setStudentDetailsModal(data as StudentInsightModalData)
  }

  async function refreshAll() {
    setSyncing(true)
    setError("")
    try {
      await Promise.all([loadClasses(schoolYear), loadSchedules(), loadLessonLogs()])
      if (workspaceTab === "turmas" && selectedClassId) {
        await loadTurmaSummary(selectedClassId)
      }
    } catch {
      setError(isEs ? "Error al actualizar." : "Erro ao atualizar.")
    } finally {
      setSyncing(false)
    }
  }

  async function exportClassGrades(
    format: "xlsx" | "pdf",
    targetBimesterOverride?: number,
  ) {
    if (!selectedClassId) return false
    const targetExportBimester = Math.max(
      1,
      Math.min(4, Number(targetBimesterOverride ?? bimester ?? 1)),
    )
    setExportingFormat(format)
    setError("")
    try {
      const res = await fetch(
        `/api/portal/gradebook/classes/${selectedClassId}/export?format=${format}&bimester=${targetExportBimester}&schoolYear=${schoolYear}`,
      )
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(
          String(
            data?.error ??
              (isEs ? "No se pudo exportar la turma." : "Nao foi possivel exportar a turma."),
          ),
        )
        return false
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get("content-disposition") || ""
      const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/)
      const fallback = `turma-b${targetExportBimester}-${schoolYear}.${format}`
      const filename = match?.[1] || fallback

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      return true
    } finally {
      setExportingFormat("")
    }
  }

  function openExportModal(format: "xlsx" | "pdf") {
    if (!selectedClassId) return
    setPendingExportFormat(format)
    setExportBimesterChoice(Math.max(1, Math.min(4, Number(bimester || 1))))
    setExportModalOpen(true)
  }

  async function confirmExportFromModal() {
    if (!pendingExportFormat) return
    const ok = await exportClassGrades(pendingExportFormat, exportBimesterChoice)
    if (ok) {
      setExportModalOpen(false)
      setPendingExportFormat("")
    }
  }

  async function syncPreferredBimesterForClass(
    classId: string,
    targetSchoolYear = schoolYear,
  ) {
    if (!classId) return null

    const res = await fetch(
      `/api/portal/gradebook/bimester-scope?classId=${classId}&schoolYear=${targetSchoolYear}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(String(data?.error ?? "Erro ao carregar bimestre da turma."))
    }

    const recommended = Number(data?.recommended_bimester ?? 0)
    if (!Number.isFinite(recommended) || recommended < 1 || recommended > 4) {
      return null
    }

    setBimester((prev) => (prev === recommended ? prev : recommended))
    return recommended
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadClasses(schoolYear), loadSchedules(), loadLessonLogs()])
      .catch(() => {
        if (active) setError(isEs ? "Error al cargar datos." : "Erro ao carregar dados.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading) return
    loadClasses(schoolYear).catch(() => setError(isEs ? "Error al cargar turmas." : "Erro ao carregar turmas."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear])

  useEffect(() => {
    if (loading) return
    if (!selectedClassId) return

    const key = `${selectedClassId}:${schoolYear}`
    if (autoBimesterKeyRef.current === key) return
    autoBimesterKeyRef.current = key

    let active = true
    setResolvingClassBimester(true)

    syncPreferredBimesterForClass(selectedClassId, schoolYear)
      .catch(() =>
        setError(isEs ? "Error al definir bimestre da turma." : "Erro ao definir bimestre da turma."),
      )
      .finally(() => {
        if (active) setResolvingClassBimester(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, schoolYear, loading])

  useEffect(() => {
    if (loading || resolvingClassBimester) return
    loadLessons(selectedClassId).catch(() => setError(isEs ? "Error al cargar clases." : "Erro ao carregar aulas."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, bimester, schoolYear, loading, resolvingClassBimester])

  useEffect(() => {
    if (loading) return
    loadLessonDetail(selectedLessonId).catch(() =>
      setError(isEs ? "Error al cargar la clase." : "Erro ao carregar a aula."),
    )
  }, [selectedLessonId, loading, isEs])

  useEffect(() => {
    if (loading) return
    void loadLessonLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (loading || workspaceTab !== "turmas") return
    loadTurmaSummary(selectedClassId).catch(() =>
      setError(isEs ? "Error al cargar datos de turma." : "Erro ao carregar dados da turma."),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceTab, selectedClassId, bimester, schoolYear, loading])

  async function useScheduleInLaunch(schedule: TeacherSchedule) {
    if (schedule.entry_type === "event" || !schedule.class_id) return

    setError("")
    const classId = String(schedule.class_id)
    let targetClass = classes.find((item) => item.id === classId)

    if (!targetClass) {
      const classRes = await fetch(`/api/portal/gradebook/classes/${classId}`, { cache: "no-store" })
      if (!classRes.ok) {
        setError(
          isEs
            ? "No se pudo abrir la turma de este horario."
            : "Nao foi possivel abrir a turma deste horario.",
        )
        return
      }

      const classData = await classRes.json().catch(() => ({}))
      const targetYear = Number(classData?.school_year ?? schoolYear)
      if (Number.isFinite(targetYear) && targetYear > 0) {
        await loadClasses(targetYear)
        setSchoolYear(targetYear)
      }
      targetClass = {
        id: classId,
        teacher_id: "",
        name: String(classData?.name ?? schedule.class_label ?? ""),
        student_year: classData?.student_year ?? null,
        school_year: targetYear,
        active: classData?.active !== false,
      }
    }

    if (targetClass.school_year && Number(targetClass.school_year) !== schoolYear) {
      await loadClasses(Number(targetClass.school_year))
      setSchoolYear(Number(targetClass.school_year))
    }

    setSelectedClassId(classId)
    setSelectedLessonId("")
    setWorkspaceTab("lancamentos")
    setLessonDate(schedule.event_date ? normalizeLessonDate(String(schedule.event_date)) : todayIsoDate())
    setLessonNotes((prev) => {
      if (prev.trim()) return prev
      return `${isEs ? "Agenda" : "Agenda"}: ${schedule.class_label} (${timeLabel(
        schedule.start_time,
      )}-${timeLabel(schedule.end_time)})`
    })

    const targetSchoolYear =
      targetClass?.school_year && Number.isFinite(Number(targetClass.school_year))
        ? Number(targetClass.school_year)
        : schoolYear
    await loadLessons(classId, { bimester, schoolYear: targetSchoolYear })
  }

  function updateEntry(studentId: string, patch: Partial<TeacherGradeLessonEntry>) {
    setEntries((prev) =>
      prev.map((item) => (item.student_id === studentId ? { ...item, ...patch } : item)),
    )
  }

  function clampEntryScore(studentId: string, field: "c1" | "c2" | "c3" | "c4", max = scoreMax) {
    setEntries((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item
        const current = item[field]
        if (current === null || current === undefined) return item
        const clamped = parseNumericInput(String(current), max)
        if (clamped === current) return item
        return { ...item, [field]: clamped }
      }),
    )
  }

  function updateQuickLaunchEntry(studentId: string, patch: Partial<TeacherGradeLessonEntry>) {
    setQuickLaunchEntries((prev) =>
      prev.map((item) => (item.student_id === studentId ? { ...item, ...patch } : item)),
    )
  }

  function clampQuickLaunchEntryScore(studentId: string, field: "c1" | "c2" | "c3" | "c4", max = scoreMax) {
    setQuickLaunchEntries((prev) =>
      prev.map((item) => {
        if (item.student_id !== studentId) return item
        const current = item[field]
        if (current === null || current === undefined) return item
        const clamped = parseNumericInput(String(current), max)
        if (clamped === current) return item
        return { ...item, [field]: clamped }
      }),
    )
  }

  async function openQuickLaunch(schedule: TeacherSchedule) {
    if (schedule.entry_type === "event" || !schedule.class_id) return

    setError("")
    setQuickLaunchLoadingStudents(true)
    setQuickLaunchOpen(true)
    setQuickLaunchSchedule(schedule)
    const defaultDate = schedule.event_date
      ? normalizeLessonDate(String(schedule.event_date))
      : todayIsoDate()
    const defaultBimester = bimester
    const defaultHasGrades = true
    setQuickLaunchDate(defaultDate)
    setQuickLaunchBimester(defaultBimester)
    setQuickLaunchHasGrades(defaultHasGrades)
    setQuickLaunchNotes("")
    setQuickLaunchObservations("")
    setQuickLaunchEntries([])
    quickLaunchInitialSnapshotRef.current = ""

    try {
      const classId = String(schedule.class_id)
      const res = await fetch(`/api/portal/gradebook/classes/${classId}/students`, {
        cache: "no-store",
      })
      const data = await res.json().catch(() => [])
      const students: TeacherClassStudent[] = Array.isArray(data) ? data : []
      const activeStudents = students.filter((student) => student.active !== false)
      const preparedEntries: TeacherGradeLessonEntry[] = activeStudents.map((student) => ({
        student_id: student.id,
        full_name: student.full_name,
        enrollment_code: student.enrollment_code ?? null,
        active: student.active !== false,
        attendance: "present",
        c1: null,
        c2: null,
        c3: null,
        c4: null,
        comment: null,
      }))

      setQuickLaunchEntries(preparedEntries)
      quickLaunchInitialSnapshotRef.current = buildQuickLaunchSnapshot({
        lessonDate: defaultDate,
        bimester: defaultBimester,
        hasGrades: defaultHasGrades,
        notes: "",
        observations: "",
        entries: preparedEntries.map((entry) => ({
          student_id: entry.student_id,
          attendance: entry.attendance ?? null,
          c1: entry.c1 ?? null,
          c2: entry.c2 ?? null,
          c3: entry.c3 ?? null,
          c4: entry.c4 ?? null,
          comment: entry.comment ?? null,
        })),
      })
    } catch {
      setError(isEs ? "No se pudo cargar alumnos." : "Nao foi possivel carregar alunos.")
      quickLaunchInitialSnapshotRef.current = buildQuickLaunchSnapshot({
        lessonDate: defaultDate,
        bimester: defaultBimester,
        hasGrades: defaultHasGrades,
        notes: "",
        observations: "",
        entries: [],
      })
    } finally {
      setQuickLaunchLoadingStudents(false)
    }
  }

  function closeQuickLaunchImmediate() {
    setQuickLaunchOpen(false)
    setQuickLaunchSchedule(null)
    setQuickLaunchLoadingStudents(false)
    setQuickLaunchSaving(false)
    setQuickLaunchEntries([])
    setQuickLaunchNotes("")
    setQuickLaunchObservations("")
    setQuickLaunchDate(todayIsoDate())
    setQuickLaunchBimester(1)
    setQuickLaunchHasGrades(true)
    quickLaunchInitialSnapshotRef.current = ""
  }

  async function submitQuickLaunchInternal(options?: { closeAfterSave?: boolean }) {
    const closeAfterSave = options?.closeAfterSave ?? true
    if (!quickLaunchSchedule?.class_id) return

    const classId = String(quickLaunchSchedule.class_id)
    const safeDate = normalizeLessonDate(quickLaunchDate)
    if (safeDate !== quickLaunchDate) setQuickLaunchDate(safeDate)

    setQuickLaunchSaving(true)
    setError("")
    const res = await fetch("/api/portal/lesson-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule_id: quickLaunchSchedule.id,
        class_id: classId,
        class_label: quickLaunchSchedule.class_label,
        school_year: schoolYear,
        bimester: quickLaunchBimester,
        lesson_date: safeDate,
        has_grades: quickLaunchHasGrades,
        notes: quickLaunchNotes,
        observations: quickLaunchObservations,
        entries: quickLaunchHasGrades
          ? quickLaunchEntries.map((entry) => ({
              student_id: entry.student_id,
              attendance: entry.attendance,
              c1: entry.c1 ?? null,
              c2: entry.c2 ?? null,
              c3: entry.c3 ?? null,
              c4: entry.c4 ?? null,
              comment: entry.comment ?? null,
            }))
          : [],
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(
        String(
          data?.error ?? (isEs ? "No se pudo lanzar la clase." : "Nao foi possivel lancar a aula."),
        ),
      )
      setQuickLaunchSaving(false)
      return
    }

    const createdLog = await res.json().catch(() => null)

    setSelectedClassId(classId)
    setBimester(quickLaunchBimester)
    setLessonDate(safeDate)
    setLessonNotes(quickLaunchNotes)

    const updatedLessons = await loadLessons(classId, {
      bimester: quickLaunchBimester,
      schoolYear,
    })
    const createdLessonNumber = Number(createdLog?.lesson_number ?? 0)
    if (createdLessonNumber > 0) {
      const createdGradeLesson = updatedLessons.find(
        (item) => Number(item.lesson_number ?? 0) === createdLessonNumber,
      )
      if (createdGradeLesson?.id) {
        setSelectedLessonId(createdGradeLesson.id)
        await loadLessonDetail(createdGradeLesson.id)
      }
    }

    await loadLessonLogs()
    setQuickLaunchSaving(false)
    if (closeAfterSave) {
      closeQuickLaunchImmediate()
    } else {
      quickLaunchInitialSnapshotRef.current = buildQuickLaunchSnapshot({
        lessonDate: safeDate,
        bimester: quickLaunchBimester,
        hasGrades: quickLaunchHasGrades,
        notes: quickLaunchNotes,
        observations: quickLaunchObservations,
        entries: quickLaunchEntries.map((entry) => ({
          student_id: entry.student_id,
          attendance: entry.attendance ?? null,
          c1: entry.c1 ?? null,
          c2: entry.c2 ?? null,
          c3: entry.c3 ?? null,
          c4: entry.c4 ?? null,
          comment: entry.comment ?? null,
        })),
      })
    }

    return true
  }

  async function submitQuickLaunch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await submitQuickLaunchInternal({ closeAfterSave: true })
  }

  async function requestCloseQuickLaunch() {
    if (quickLaunchSaving) return
    if (!hasQuickLaunchChanges) {
      closeQuickLaunchImmediate()
      return
    }

    const saveBeforeClose = window.confirm(getQuickLaunchDirtyText(locale))
    if (saveBeforeClose) {
      await submitQuickLaunchInternal({ closeAfterSave: true })
      return
    }

    const discard = window.confirm(getQuickLaunchDiscardText(locale))
    if (!discard) return
    closeQuickLaunchImmediate()
  }

  async function saveLesson() {
    if (!selectedLessonId) return
    const safeDate = normalizeLessonDate(lessonDate)
    if (safeDate !== lessonDate) setLessonDate(safeDate)

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/gradebook/lessons/${selectedLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_date: safeDate,
        has_grades: lessonHasGrades,
        notes: lessonNotes,
        entries: lessonHasGrades
          ? entries.map((item) => ({
              student_id: item.student_id,
              attendance: item.attendance,
              c1: item.c1 ?? null,
              c2: item.c2 ?? null,
              c3: item.c3 ?? null,
              c4: item.c4 ?? null,
              comment: item.comment ?? null,
            }))
          : [],
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo guardar." : "Nao foi possivel salvar.")))
      return
    }

    await loadLessons(selectedClassId)
    await loadLessonDetail(selectedLessonId)
    await loadLessonLogs()
  }

  function toggleLogGroup(key: string) {
    setOpenLogGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function startViewLog(log: TeacherLessonLog) {
    setError("")
    setEditingLog(null)
    setViewingLog({
      id: log.id,
      class_label: log.class_label,
      lesson_number: log.lesson_number,
      bimester:
        typeof log.bimester === "number" && log.bimester >= 1 && log.bimester <= 4
          ? log.bimester
          : inferBimesterFromDate(log.lesson_date),
      lesson_date: normalizeLessonDate(String(log.lesson_date ?? "")),
      notes: String(log.notes ?? ""),
      observations: String(log.observations ?? ""),
    })
  }

  function startEditLog(log: TeacherLessonLog) {
    setError("")
    setViewingLog(null)
    setEditingLog({
      id: log.id,
      class_label: log.class_label,
      lesson_number: log.lesson_number,
      bimester:
        typeof log.bimester === "number" && log.bimester >= 1 && log.bimester <= 4
          ? log.bimester
          : inferBimesterFromDate(log.lesson_date),
      lesson_date: normalizeLessonDate(String(log.lesson_date ?? "")),
      notes: String(log.notes ?? ""),
      observations: String(log.observations ?? ""),
    })
  }

  async function submitLogEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingLog) return

    setSaving(true)
    setError("")
    const res = await fetch(`/api/portal/lesson-logs/${editingLog.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_date: normalizeLessonDate(editingLog.lesson_date),
        bimester: editingLog.bimester,
        notes: editingLog.notes,
        observations: editingLog.observations,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(String(data?.error ?? (isEs ? "No se pudo guardar." : "Nao foi possivel salvar.")))
      return
    }

    setEditingLog(null)
    await loadLessonLogs()
  }

  function renderScheduleCard(schedule: TeacherSchedule) {
    const isEvent = schedule.entry_type === "event"
    const hasClass = Boolean(schedule.class_id)
    const shiftPeriod = getShiftPeriod(schedule.start_time)
    const isMorning = shiftPeriod === "morning"
    const shiftLabel = isMorning
      ? isEs
        ? "Matutino"
        : "Matutino"
      : isEs
        ? "Vespertino"
        : "Vespertino"
    const classIdKey = String(schedule.class_id ?? "").trim()
    const classLabelKey = normalizeClassLabel(schedule.class_label)
    const classSummary =
      (classIdKey ? lessonSummaryByClass.byClassId.get(classIdKey) : null) ??
      lessonSummaryByClass.byClassLabel.get(classLabelKey) ??
      null
    const classMatchesSelection =
      hasClass && selectedClassId && String(schedule.class_id) === String(selectedClassId)
    const defaultCardClass = "border-white/10 bg-white/[0.04]"
    const selectedCardClass = "border-cyan-300/45 bg-cyan-500/10"
    const metaClass = isMorning ? "text-amber-100/90" : "text-sky-100/90"

    return (
      <div
        key={schedule.id}
        className={`rounded-lg border p-2 space-y-1 ${
          classMatchesSelection
            ? selectedCardClass
            : defaultCardClass
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs sm:text-[13px] font-semibold text-white leading-tight">{schedule.class_label}</p>
        </div>
        <p className={`text-[11px] ${metaClass}`}>
          {shiftLabel} • {isEvent ? (isEs ? "Evento" : "Evento") : isEs ? "Turma" : "Turma"} •{" "}
          {timeLabel(schedule.start_time)} - {timeLabel(schedule.end_time)}
        </p>
        {!isEvent && hasClass ? (
          <p className={`hidden sm:block text-[11px] ${classMatchesSelection ? "text-cyan-100" : "text-slate-300"}`}>
            {isEs ? "Clases registradas" : "Aulas registradas"}: {classSummary?.count ?? 0}
            {classSummary?.latestLessonNumber ? ` • ${isEs ? "Clase" : "Aula"} ${classSummary.latestLessonNumber}` : ""}
            {classSummary?.latestBimester ? ` • B${classSummary.latestBimester}` : ""}
            {classSummary?.latestDate ? ` • ${formatDatePtBr(classSummary.latestDate)}` : ""}
          </p>
        ) : null}
        {hasClass && !isEvent ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => void openQuickLaunch(schedule)}
              className={`h-6 text-[11px] px-2 ${
                isMorning
                  ? "bg-amber-600 hover:bg-amber-700 text-amber-50"
                  : "bg-sky-600 hover:bg-sky-700 text-sky-50"
              }`}
            >
              {isEs ? "Lanzar clase" : "Lancar aula"}
            </Button>
            <Button
              type="button"
              onClick={() => void useScheduleInLaunch(schedule)}
              className="h-6 text-[11px] px-2 bg-white/10 hover:bg-white/15 border border-white/10"
            >
              {isEs ? "Abrir turma" : "Abrir turma"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            {isEs ? "Evento sin notas." : "Evento sem notas."}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-amber-300" />
          {isEs ? "Lanzamientos + Agenda" : "Lancamentos + Agenda"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isEs
            ? "Agenda y notas en un solo flujo para encontrar todo más rápido."
            : "Agenda e notas no mesmo fluxo para achar tudo mais rapido."}
        </p>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <Label className="text-white">{isEs ? "Ano lectivo" : "Ano letivo"}</Label>
              <Input
                type="number"
                value={schoolYear}
                onChange={(e) => setSchoolYear(Number(e.target.value || new Date().getFullYear()))}
                className="mt-1 bg-slate-800/70 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-white">{isEs ? "Bimestre" : "Bimestre"}</Label>
              <select
                value={bimester}
                onChange={(e) => setBimester(Number(e.target.value))}
                className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-white">{isEs ? "Turma" : "Turma"}</Label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
              >
                <option value="">{isEs ? "Sin turma" : "Sem turma"}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.student_year ? `• ${getTurmaYearLabel(item.student_year)}` : ""} • #{item.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 md:self-end">
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button
                  onClick={refreshAll}
                  disabled={syncing}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  <RefreshCcw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {isEs ? "Actualizar" : "Atualizar"}
                </Button>
                <Button
                  type="button"
                  onClick={() => openExportModal("xlsx")}
                  disabled={exportingFormat !== "" || !selectedClassId}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  {exportingFormat === "xlsx"
                    ? isEs
                      ? "Exportando XLSX..."
                      : "Exportando XLSX..."
                    : isEs
                      ? "Exportar XLSX"
                      : "Exportar XLSX"}
                </Button>
                <Button
                  type="button"
                  onClick={() => openExportModal("pdf")}
                  disabled={exportingFormat !== "" || !selectedClassId}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  {exportingFormat === "pdf"
                    ? isEs
                      ? "Exportando PDF..."
                      : "Exportando PDF..."
                    : isEs
                      ? "Exportar PDF"
                      : "Exportar PDF"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              onClick={() => setWorkspaceTab("agenda")}
              className={`justify-start ${
                workspaceTab === "agenda"
                  ? "bg-cyan-600 hover:bg-cyan-700"
                  : "bg-white/10 hover:bg-white/15 border border-white/10"
              }`}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              {isEs ? "Agenda" : "Agenda"}
            </Button>
            <Button
              type="button"
              onClick={() => setWorkspaceTab("lancamentos")}
              className={`justify-start ${
                workspaceTab === "lancamentos"
                  ? "bg-cyan-600 hover:bg-cyan-700"
                  : "bg-white/10 hover:bg-white/15 border border-white/10"
              }`}
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              {isEs ? "Lanzamientos" : "Lancamentos"}
            </Button>
            <Button
              type="button"
              onClick={() => setWorkspaceTab("turmas")}
              className={`justify-start ${
                workspaceTab === "turmas"
                  ? "bg-cyan-600 hover:bg-cyan-700"
                  : "bg-white/10 hover:bg-white/15 border border-white/10"
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              {isEs ? "Notas finales" : "Notas Finais"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {workspaceTab === "agenda" ? (
      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-cyan-300" />
            {isEs ? "Agenda integrada al lanzamiento" : "Agenda integrada ao lancamento"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">
            {isEs
              ? "Vista semanal por columnas: cada turma de agenda usa el mismo flujo de notas."
              : "Visual semanal por colunas: cada turma da agenda usa o mesmo fluxo de notas."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
            {weekdayOptions.map((day) => {
              const daySchedules = recurringByWeekday[day.value] ?? []
              const morningSchedules = daySchedules.filter((schedule) => getShiftPeriod(schedule.start_time) === "morning")
              const afternoonSchedules = daySchedules.filter((schedule) => getShiftPeriod(schedule.start_time) === "afternoon")
              const periodGroups = [
                {
                  key: "morning",
                  label: isEs ? "Matutino" : "Matutino",
                  list: morningSchedules,
                  wrapperClass: "border-amber-300/20 bg-amber-500/5",
                  badgeClass: "text-amber-100 bg-amber-500/15 border border-amber-300/25",
                  countClass: "text-amber-100/95",
                },
                {
                  key: "afternoon",
                  label: isEs ? "Vespertino" : "Vespertino",
                  list: afternoonSchedules,
                  wrapperClass: "border-sky-300/20 bg-sky-500/5",
                  badgeClass: "text-sky-100 bg-sky-500/15 border border-sky-300/25",
                  countClass: "text-sky-100/95",
                },
              ] as const
              const visibleGroups = periodGroups.filter((group) => group.list.length > 0)
              return (
                <div
                  key={day.value}
                  className="rounded-xl border border-white/10 bg-slate-950/20 p-2 space-y-1.5 min-h-[140px]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{day.full}</p>
                    <span className="text-[11px] text-slate-400">{daySchedules.length}</span>
                  </div>
                  {visibleGroups.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      {isEs ? "Sin clases." : "Sem aulas."}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleGroups.map((group) => (
                        <div key={group.key} className={`rounded-lg border p-1.5 space-y-1 ${group.wrapperClass}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${group.badgeClass}`}>
                              {group.label}
                            </span>
                            <span className={`text-[10px] font-semibold ${group.countClass}`}>
                              {group.list.length}
                            </span>
                          </div>
                          {group.list.length === 0 ? (
                            <p className="text-xs text-white/70">
                              {isEs ? "Sin clases." : "Sem aulas."}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {group.list.map((schedule) => renderScheduleCard(schedule))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 space-y-3">
            <p className="text-sm font-semibold text-white">
              {isEs ? "Eventos puntuales próximos" : "Eventos pontuais proximos"}
            </p>
            {oneOffEvents.length === 0 ? (
              <p className="text-sm text-slate-400">
                {isEs ? "Sin eventos puntuales." : "Sem eventos pontuais."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {oneOffEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <p className="text-sm text-white font-medium">{event.class_label}</p>
                    <p className="text-xs text-slate-300">
                      {formatDatePtBr(String(event.event_date ?? ""))} • {timeLabel(event.start_time)} -{" "}
                      {timeLabel(event.end_time)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 space-y-3">
            <p className="text-sm font-semibold text-white">
              {isEs ? "Historial de registros de clase" : "Historico de registros de aula"}
            </p>
            {groupedLessonLogs.length === 0 ? (
              <p className="text-sm text-slate-400">
                {isEs ? "Sin registros en agenda." : "Sem registros na agenda."}
              </p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {groupedLessonLogs.map((group) => {
                  const isOpen = openLogGroups[group.key] ?? false
                  return (
                    <div key={group.key} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleLogGroup(group.key)}
                        className="w-full px-3 py-2 flex items-center justify-between gap-2 border-b border-white/10"
                      >
                        <span className="text-sm text-white font-semibold truncate">
                          {group.label}
                        </span>
                        <span className="inline-flex items-center gap-2 text-xs text-slate-300">
                          {group.items.length}
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </button>

                      {isOpen ? (
                        <div className="space-y-2 p-2">
                          {group.items.map((log) => (
                            <div
                              key={log.id}
                              className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm text-white font-medium">
                                  {isEs ? "Clase" : "Aula"} {log.lesson_number}
                                  {" • "}
                                  B
                                  {typeof log.bimester === "number" && log.bimester >= 1 && log.bimester <= 4
                                    ? log.bimester
                                    : inferBimesterFromDate(log.lesson_date)}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    title={isEs ? "Ver" : "Visualizar"}
                                    aria-label={isEs ? "Ver" : "Visualizar"}
                                    onClick={() => startViewLog(log)}
                                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    title={isEs ? "Editar" : "Editar"}
                                    aria-label={isEs ? "Editar" : "Editar"}
                                    onClick={() => startEditLog(log)}
                                    className="bg-cyan-600 hover:bg-cyan-700"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-slate-300">{formatDatePtBr(log.lesson_date)}</p>
                              {String(log.notes ?? "").trim() ? (
                                <p className="text-xs text-slate-400 mt-1">{previewText(log.notes, 120)}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {workspaceTab === "lancamentos" ? (
        selectedClass ? (
          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">
                {isEs ? "Clases del bimestre" : "Aulas do bimestre"} • {selectedClass.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-300">
                {isEs
                  ? "Visualiza el estado y abre la clase para lanzar/editar notas."
                  : "Visualize o status e abra a aula para lancar/editar notas."}
              </p>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="max-h-[520px] overflow-y-auto space-y-2 p-2">
                  {orderedLessons.map((lesson) => {
                    const noGrades = lesson.has_grades === false
                    const totalStudents = Number(lesson.total_students ?? 0)
                    const totalActiveStudents = Number(lesson.total_active_students ?? totalStudents)
                    const nonEligibleStudents = Number(
                      lesson.non_eligible_students ?? Math.max(totalActiveStudents - totalStudents, 0),
                    )
                    const gradedEntries = Number(lesson.graded_entries_count ?? 0)
                    const completionPercentRaw =
                      noGrades
                        ? 100
                        : lesson.completion_percent === null || lesson.completion_percent === undefined
                        ? totalStudents > 0
                          ? (gradedEntries / totalStudents) * 100
                          : 0
                        : Number(lesson.completion_percent)
                    const completionPercent = Math.max(0, Math.min(100, completionPercentRaw))
                    const isComplete =
                      noGrades ||
                      lesson.fully_launched === true ||
                      totalStudents === 0 ||
                      (totalStudents > 0 && gradedEntries >= totalStudents)

                    return (
                      <div
                        key={lesson.id}
                        className={`rounded-lg border px-3 py-2.5 ${
                          isComplete
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-rose-500/40 bg-rose-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {isEs ? "Clase" : "Aula"} {lesson.lesson_number}
                            </p>
                            <p className="text-xs text-slate-200">{formatDatePtBr(lesson.lesson_date)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span
                              className={`text-[11px] px-2 py-1 rounded-full border ${
                                isComplete
                                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                                  : "border-rose-400/50 bg-rose-500/20 text-rose-100"
                              }`}
                            >
                              {isComplete
                                ? noGrades
                                  ? isEs
                                    ? "Sin nota (completa)"
                                    : "Sem nota (completa)"
                                  : totalStudents === 0
                                    ? isEs
                                      ? "Sin alumnos elegibles"
                                      : "Sem alunos elegiveis"
                                  : isEs
                                  ? "100% completo"
                                  : "100% completo"
                                : `${isEs ? "Pendiente" : "Pendente"} • ${completionPercent.toFixed(0)}%`}
                            </span>
                            <span className="text-[11px] px-2 py-1 rounded-full border border-white/15 bg-white/5 text-slate-200">
                              {noGrades
                                ? isEs
                                  ? "Diario sin notas"
                                  : "Diario sem notas"
                                : `${gradedEntries}/${totalStudents} ${
                                    isEs ? "alumnos con notas" : "alunos com notas"
                                  }${nonEligibleStudents > 0 ? ` • N/A ${nonEligibleStudents}` : ""}`}
                            </span>
                            <Button
                              type="button"
                              onClick={() => openLessonFromList(lesson.id)}
                              className="h-8 inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/20 px-3 text-xs text-cyan-100 hover:bg-cyan-500/30"
                            >
                              {isEs ? "Abrir clase" : "Abrir aula"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {orderedLessons.length === 0 ? (
                    <p className="p-2 text-sm text-slate-400">
                      {isEs ? "Sin clases en este bimestre." : "Sem aulas neste bimestre."}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-slate-300">
                {isEs
                  ? 'Use "Abrir clase" para editar en modal.'
                  : 'Use "Abrir aula" para editar em modal.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-400">
                {isEs ? "Seleccione una turma para comenzar." : "Selecione uma turma para comecar."}
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      {workspaceTab === "turmas" ? (
        selectedClass ? (
          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between gap-3 flex-wrap">
                <span>
                  {isEs ? "Turma" : "Turma"} • {selectedClass.name} • {isEs ? "Bimestre" : "Bimestre"} {bimester}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      turmaClosed
                        ? "bg-rose-500/15 border-rose-400/40 text-rose-100"
                        : "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
                    }`}
                  >
                    {turmaClosed
                      ? isEs
                        ? "Bimestre cerrado"
                        : "Bimestre fechado"
                      : isEs
                        ? "Bimestre abierto"
                        : "Bimestre aberto"}
                  </span>
                  <Button
                    type="button"
                    onClick={() => void saveTurmaGrades()}
                    disabled={turmaSaving || turmaLoading || turmaClosed || turmaRows.length === 0}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {turmaSaving
                      ? isEs
                        ? "Guardando..."
                        : "Salvando..."
                      : isEs
                        ? "Guardar notas"
                        : "Salvar notas"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {turmaLoading ? (
                <p className="text-sm text-slate-300">{isEs ? "Cargando turma..." : "Carregando turma..."}</p>
              ) : turmaRows.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {isEs ? "No hay alumnos activos en la turma." : "Nao ha alunos ativos na turma."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs text-slate-300">
                    {isEs
                      ? "Atajo: Enter avanza Prova/Actividad, C5 y Final por alumno. Flechas tambien navegan."
                      : "Atalho: Enter avanca Prova/Atividade, C5 e Final por aluno. Setas tambem navegam."}
                  </p>
                  <table className="min-w-[1200px] w-full text-sm text-slate-100">
                    <thead>
                      <tr className="text-slate-200 border-b border-white/10">
                        <th className="text-left py-2 pr-2">{isEs ? "Alumno" : "Aluno"}</th>
                        <th className="text-center py-2 pr-1">{isEs ? "Presencias" : "Presencas"}</th>
                        <th className="text-center py-2 pr-1">{isEs ? "Faltas" : "Faltas"}</th>
                        <th className="text-center py-2 pr-1">{isEs ? "Frecuencia" : "Frequencia"}</th>
                        <th className="text-center py-2 pr-1">{isEs ? "Clases" : "Aulas"}</th>
                        <th className="text-center py-2 pr-1">Nota 1</th>
                        <th className="text-center py-2 pr-1">{isEs ? "Prueba/Actividad" : "Prova/Atividade"}</th>
                        <th className="text-center py-2 pr-1">C5</th>
                        <th className="text-center py-2 pr-1">Nota 2</th>
                        <th className="text-center py-2 pr-1">{isEs ? "Final" : "Final"}</th>
                        <th className="text-left py-2 pr-2">{isEs ? "Observaciones" : "Observacoes"}</th>
                        <th className="text-center py-2">{isEs ? "Detalles" : "Detalhes"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turmaRows.map((row, rowIndex) => {
                        const form = turmaGradeForm[row.student_id] ?? {
                          exam_score: "",
                          c5_score: "",
                          manual_final_score: "",
                          notes: "",
                        }
                        const note1 = toNumber(row.note1)
                        const exam = parseNote2Component(form.exam_score)
                        const c5 = parseNote2Component(form.c5_score)
                        const note2 = calcNote2(exam, c5, isPyScoreScale)
                        const calculatedFinal = calcFinal(note1, note2)
                        const manualFinal = parseNumericInput(form.manual_final_score, scoreMax)
                        const finalValue = manualFinal ?? calculatedFinal
                        const finalInputValue = buildAutoFinalInputValue(
                          form.manual_final_score,
                          note1,
                          note2,
                          scoreMax,
                        )
                        const attendanceBase = Number(row.presence_count ?? 0) + Number(row.absence_count ?? 0)
                        const attendancePercent =
                          attendanceBase > 0
                            ? Math.round((Number(row.presence_count ?? 0) / attendanceBase) * 10000) / 100
                            : null

                        return (
                          <tr key={row.student_id} className="border-b border-white/10 last:border-b-0 odd:bg-white/[0.02]">
                            <td className="py-2 pr-2 text-white max-w-[220px] truncate">{row.full_name}</td>
                            <td className="py-2 pr-1 text-center">{row.presence_count}</td>
                            <td className="py-2 pr-1 text-center">{row.absence_count}</td>
                            <td className="py-2 pr-1 text-center">
                              {attendancePercent === null ? "-" : `${attendancePercent.toFixed(2)}%`}
                            </td>
                            <td className="py-2 pr-1 text-center">{row.graded_lessons}</td>
                            <td className="py-2 pr-1 text-center">{displayScore(note1)}</td>
                            <td className="py-2 pr-1 text-center">
                              <Input
                                ref={(el) => setTurmaScoreInputRef(row.student_id, "exam_score", el)}
                                type="number"
                                min={0}
                                max={note2ComponentMax}
                                step={0.01}
                                value={form.exam_score}
                                onChange={(e) =>
                                  setTurmaGradeForm((prev) => ({
                                    ...prev,
                                    [row.student_id]: { ...prev[row.student_id], exam_score: e.target.value },
                                  }))
                                }
                                onBlur={() => clampTurmaField(row.student_id, "exam_score", note2ComponentMax)}
                                onKeyDown={(e) => handleTurmaScoreKeyDown(e, rowIndex, "exam_score")}
                                className={scoreInputClass}
                                disabled={turmaClosed}
                              />
                            </td>
                            <td className="py-2 pr-1 text-center">
                              <Input
                                ref={(el) => setTurmaScoreInputRef(row.student_id, "c5_score", el)}
                                type="number"
                                min={0}
                                max={note2ComponentMax}
                                step={0.01}
                                value={form.c5_score}
                                onChange={(e) =>
                                  setTurmaGradeForm((prev) => ({
                                    ...prev,
                                    [row.student_id]: { ...prev[row.student_id], c5_score: e.target.value },
                                  }))
                                }
                                onBlur={() => clampTurmaField(row.student_id, "c5_score", note2ComponentMax)}
                                onKeyDown={(e) => handleTurmaScoreKeyDown(e, rowIndex, "c5_score")}
                                className={scoreInputClass}
                                disabled={turmaClosed}
                              />
                            </td>
                            <td className="py-2 pr-1 text-center">{displayScore(note2)}</td>
                            <td className="py-2 pr-1 text-center">
                              <Input
                                ref={(el) => setTurmaScoreInputRef(row.student_id, "manual_final_score", el)}
                                type="number"
                                min={0}
                                max={scoreMax}
                                step={0.01}
                                value={finalInputValue}
                                placeholder={displayScore(calculatedFinal)}
                                onChange={(e) =>
                                  setTurmaGradeForm((prev) => ({
                                    ...prev,
                                    [row.student_id]: { ...prev[row.student_id], manual_final_score: e.target.value },
                                  }))
                                }
                                onBlur={() => clampTurmaField(row.student_id, "manual_final_score", scoreMax)}
                                onKeyDown={(e) => handleTurmaScoreKeyDown(e, rowIndex, "manual_final_score")}
                                className={scoreInputClass}
                                disabled={turmaClosed}
                                title={`${isEs ? "Valor final" : "Valor final"}: ${displayScore(finalValue)}`}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                value={form.notes}
                                onChange={(e) =>
                                  setTurmaGradeForm((prev) => ({
                                    ...prev,
                                    [row.student_id]: { ...prev[row.student_id], notes: e.target.value },
                                  }))
                                }
                                className="h-8 min-w-[180px] bg-slate-800/80 border-slate-700 text-slate-100"
                                disabled={turmaClosed}
                              />
                            </td>
                            <td className="py-2 text-center">
                              <Button
                                type="button"
                                onClick={() => void openStudentDetails(row.student_id)}
                                className="h-8 px-2.5 bg-white/10 hover:bg-white/15 border border-white/10"
                              >
                                <Eye className="w-4 h-4 mr-1.5" />
                                {isEs ? "Detalles" : "Detalhes"}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-400">
                {isEs ? "Seleccione una turma para ver notas." : "Selecione uma turma para ver as notas."}
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      {lessonModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => {
              if (saving) return
              setLessonModalOpen(false)
            }}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />
          <Card className="relative z-10 w-full max-w-6xl max-h-[92vh] overflow-hidden bg-slate-900/95 border border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {selectedLesson
                    ? `${isEs ? "Edicion de clase" : "Edicao da aula"} ${selectedLesson.lesson_number}`
                    : isEs
                      ? "Edicion de clase"
                      : "Edicao da aula"}
                </span>
                <Button
                  type="button"
                  onClick={() => {
                    if (saving) return
                    setLessonModalOpen(false)
                  }}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  {isEs ? "Cerrar" : "Fechar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(92vh-78px)] space-y-4 pt-4">
              {lessonModalLoading ? (
                <p className="text-sm text-slate-300">
                  {isEs ? "Cargando clase..." : "Carregando aula..."}
                </p>
              ) : selectedLesson ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-white">{isEs ? "Fecha de la clase" : "Data da aula"}</Label>
                      <Input
                        type="date"
                        value={lessonDate}
                        onChange={(e) => setLessonDate(normalizeLessonDate(e.target.value))}
                        onBlur={() => setLessonDate((prev) => normalizeLessonDate(prev))}
                        className="bg-slate-800/70 border-slate-700 text-white"
                      />
                    </div>
                    <div className="md:col-span-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 self-end">
                      <label className="inline-flex items-center gap-2 text-sm text-white cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-cyan-500"
                          checked={lessonHasGrades}
                          onChange={(e) => setLessonHasGrades(e.target.checked)}
                        />
                        {isEs ? "Clase con nota" : "Aula com nota"}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Texto libre (diario)" : "Texto livre (diario)"}</Label>
                    <textarea
                      rows={3}
                      value={lessonNotes}
                      onChange={(e) => setLessonNotes(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  {lessonHasGrades ? (
                    entries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <p className="mb-2 text-xs text-slate-300">
                          {isEs
                            ? "Atajo: Enter avanza C1 a C4 y al siguiente alumno. Flechas tambien navegan."
                            : "Atalho: Enter avanca C1 a C4 e para o proximo aluno. Setas tambem navegam."}
                        </p>
                        <table className="min-w-[980px] w-full text-sm text-slate-100">
                          <thead>
                            <tr className="text-slate-200 border-b border-white/10">
                              <th className="text-left py-2 px-3">{isEs ? "Alumno" : "Aluno"}</th>
                              <th className="text-left py-2 px-2">{isEs ? "Asistencia" : "Presenca"}</th>
                              <th className="text-left py-2 px-2">C1</th>
                              <th className="text-left py-2 px-2">C2</th>
                              <th className="text-left py-2 px-2">C3</th>
                              <th className="text-left py-2 px-2">C4</th>
                              <th className="text-left py-2 px-2">{isEs ? "Observacion" : "Observacao"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((entry, rowIndex) => (
                              <tr key={entry.student_id} className="border-b border-white/10 last:border-b-0 odd:bg-white/[0.02]">
                                <td className="py-2 px-3 text-white max-w-[240px] truncate">{entry.full_name}</td>
                                <td className="py-2 px-2">
                                  <label className="inline-flex items-center">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-cyan-500 cursor-pointer"
                                      checked={entry.attendance !== "absent"}
                                      onChange={(e) =>
                                        updateEntry(entry.student_id, {
                                          attendance: e.target.checked ? "present" : "absent",
                                        })
                                      }
                                    />
                                  </label>
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    ref={(el) => setLessonScoreInputRef(entry.student_id, "c1", el)}
                                    type="number"
                                    min={0}
                                    max={scoreMax}
                                    step={0.01}
                                    value={entry.c1 ?? ""}
                                    onChange={(e) =>
                                      updateEntry(entry.student_id, {
                                        c1: parseNumericInput(e.target.value, scoreMax),
                                      })
                                    }
                                    onBlur={() => clampEntryScore(entry.student_id, "c1", scoreMax)}
                                    onKeyDown={(e) => handleLessonScoreKeyDown(e, rowIndex, "c1")}
                                    className={scoreInputClass}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    ref={(el) => setLessonScoreInputRef(entry.student_id, "c2", el)}
                                    type="number"
                                    min={0}
                                    max={scoreMax}
                                    step={0.01}
                                    value={entry.c2 ?? ""}
                                    onChange={(e) =>
                                      updateEntry(entry.student_id, {
                                        c2: parseNumericInput(e.target.value, scoreMax),
                                      })
                                    }
                                    onBlur={() => clampEntryScore(entry.student_id, "c2", scoreMax)}
                                    onKeyDown={(e) => handleLessonScoreKeyDown(e, rowIndex, "c2")}
                                    className={scoreInputClass}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    ref={(el) => setLessonScoreInputRef(entry.student_id, "c3", el)}
                                    type="number"
                                    min={0}
                                    max={scoreMax}
                                    step={0.01}
                                    value={entry.c3 ?? ""}
                                    onChange={(e) =>
                                      updateEntry(entry.student_id, {
                                        c3: parseNumericInput(e.target.value, scoreMax),
                                      })
                                    }
                                    onBlur={() => clampEntryScore(entry.student_id, "c3", scoreMax)}
                                    onKeyDown={(e) => handleLessonScoreKeyDown(e, rowIndex, "c3")}
                                    className={scoreInputClass}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    ref={(el) => setLessonScoreInputRef(entry.student_id, "c4", el)}
                                    type="number"
                                    min={0}
                                    max={scoreMax}
                                    step={0.01}
                                    value={entry.c4 ?? ""}
                                    onChange={(e) =>
                                      updateEntry(entry.student_id, {
                                        c4: parseNumericInput(e.target.value, scoreMax),
                                      })
                                    }
                                    onBlur={() => clampEntryScore(entry.student_id, "c4", scoreMax)}
                                    onKeyDown={(e) => handleLessonScoreKeyDown(e, rowIndex, "c4")}
                                    className={scoreInputClass}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    value={entry.comment ?? ""}
                                    onChange={(e) =>
                                      updateEntry(entry.student_id, {
                                        comment: e.target.value || null,
                                      })
                                    }
                                    className="h-8 bg-slate-800/80 border-slate-700 text-white text-xs"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-300">
                        {isEs ? "Sin alumnos para esta clase." : "Sem alunos para esta aula."}
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-slate-300">
                      {isEs
                        ? "Esta clase no requiere C1-C4. Puede guardar solo con diario."
                        : "Esta aula nao exige C1-C4. Pode salvar apenas com o diario."}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => setLessonModalOpen(false)}
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                      disabled={saving}
                    >
                      {isEs ? "Cancelar" : "Cancelar"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void saveLesson()}
                      disabled={saving || !selectedLessonId}
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving
                        ? isEs
                          ? "Guardando..."
                          : "Salvando..."
                        : isEs
                          ? "Guardar clase"
                          : "Salvar aula"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  {isEs ? "Seleccione una clase." : "Selecione uma aula."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {studentDetailsLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
          <Card className="relative z-10 w-full max-w-md bg-slate-900/95 border border-white/10 text-white">
            <CardContent className="py-8">
              <p className="text-center text-sm text-slate-200">
                {isEs ? "Cargando detalles del alumno..." : "Carregando detalhes do aluno..."}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {studentDetailsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => setStudentDetailsModal(null)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />
          <Card className="relative z-10 w-full max-w-6xl max-h-[92vh] overflow-hidden bg-slate-900/95 border border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {studentDetailsModal.student.full_name} • {isEs ? "Detalles" : "Detalhes"}
                </span>
                <Button
                  type="button"
                  onClick={() => setStudentDetailsModal(null)}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  {isEs ? "Cerrar" : "Fechar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(92vh-78px)] space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Turma" : "Turma"}</p>
                  <p className="text-sm text-white">{studentDetailsModal.class.name}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Ano lectivo" : "Ano letivo"}</p>
                  <p className="text-sm text-white">{studentDetailsModal.class.school_year}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Presencias" : "Presencas"}</p>
                  <p className="text-sm text-white">{studentDetailsModal.totals.presence_count}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Frecuencia" : "Frequencia"}</p>
                  <p className="text-sm text-white">
                    {studentDetailsModal.totals.attendance_percent === null
                      ? "-"
                      : `${Number(studentDetailsModal.totals.attendance_percent).toFixed(2)}%`}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-x-auto">
                <table className="min-w-[860px] w-full text-sm">
                  <thead>
                    <tr className="text-slate-300 border-b border-white/10">
                      <th className="text-left py-2 px-3">{isEs ? "Bimestre" : "Bimestre"}</th>
                      <th className="text-left py-2 px-2">{isEs ? "Clases" : "Aulas"}</th>
                      <th className="text-left py-2 px-2">Nota 1</th>
                      <th className="text-left py-2 px-2">{isEs ? "Prueba/Actividad" : "Prova/Atividade"}</th>
                      <th className="text-left py-2 px-2">C5</th>
                      <th className="text-left py-2 px-2">Nota 2</th>
                      <th className="text-left py-2 px-2">{isEs ? "Final" : "Final"}</th>
                      <th className="text-left py-2 px-2">{isEs ? "Observaciones" : "Observacoes"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentDetailsModal.bimesters.map((item) => (
                      <tr key={item.bimester} className="border-b border-white/10 last:border-b-0">
                        <td className="py-2 px-3">B{item.bimester}</td>
                        <td className="py-2 px-2">{item.graded_lessons}</td>
                        <td className="py-2 px-2">{displayScore(item.note1)}</td>
                        <td className="py-2 px-2">{displayScore(item.exam_score)}</td>
                        <td className="py-2 px-2">{displayScore(item.c5_score)}</td>
                        <td className="py-2 px-2">{displayScore(item.note2)}</td>
                        <td className="py-2 px-2">{displayScore(item.final_grade)}</td>
                        <td className="py-2 px-2">{String(item.notes ?? "").trim() || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 space-y-2">
                <p className="text-sm font-semibold text-white">{isEs ? "Historial de clases" : "Historico de aulas"}</p>
                {studentDetailsModal.lessons.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {isEs ? "Sin historial para este ano." : "Sem historico para este ano."}
                  </p>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto space-y-2">
                    {studentDetailsModal.lessons.map((lesson) => (
                      <div key={lesson.lesson_id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm text-white">
                            B{lesson.bimester} • {isEs ? "Clase" : "Aula"} {lesson.lesson_number}
                          </p>
                          <p className="text-xs text-slate-300">{formatDatePtBr(lesson.lesson_date)}</p>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          {isEs ? "Asistencia" : "Presenca"}:{" "}
                          {lesson.attendance === "absent"
                            ? isEs
                              ? "Falta"
                              : "Falta"
                            : lesson.attendance === "present"
                              ? isEs
                                ? "Presente"
                                : "Presente"
                              : "-"}
                          {" • "}C1 {displayScore(lesson.c1)} | C2 {displayScore(lesson.c2)} | C3{" "}
                          {displayScore(lesson.c3)} | C4 {displayScore(lesson.c4)}
                        </p>
                        {String(lesson.comment ?? "").trim() ? (
                          <p className="text-xs text-slate-400 mt-1">
                            {isEs ? "Observacion" : "Observacao"}: {lesson.comment}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {viewingLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setViewingLog(null)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />
          <Card className="relative z-10 w-full max-w-2xl bg-slate-900/95 border border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {isEs ? "Registro de clase" : "Registro de aula"} #{viewingLog.lesson_number} • B
                  {viewingLog.bimester}
                </span>
                <Button
                  type="button"
                  onClick={() => setViewingLog(null)}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  {isEs ? "Cerrar" : "Fechar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Turma" : "Turma"}</p>
                  <p className="text-sm text-white">{viewingLog.class_label}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Fecha" : "Data"}</p>
                  <p className="text-sm text-white">{formatDatePtBr(viewingLog.lesson_date)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{isEs ? "Bimestre" : "Bimestre"}</p>
                  <p className="text-sm text-white">B{viewingLog.bimester}</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-xs text-slate-300 mb-1">{isEs ? "Observaciones" : "Observacoes"}</p>
                <p className="text-sm text-slate-100 whitespace-pre-wrap">
                  {viewingLog.observations.trim() || "-"}
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-xs text-slate-300 mb-1">{isEs ? "Notas" : "Anotacoes"}</p>
                <p className="text-sm text-slate-100 whitespace-pre-wrap">
                  {viewingLog.notes.trim() || "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {editingLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setEditingLog(null)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />
          <Card className="relative z-10 w-full max-w-2xl bg-slate-900/95 border border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {isEs ? "Editar registro" : "Editar registro"} #{editingLog.lesson_number} • B
                  {editingLog.bimester}
                </span>
                <Button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  {isEs ? "Cancelar" : "Cancelar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void submitLogEdit(e)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Turma" : "Turma"}</Label>
                    <Input
                      value={editingLog.class_label}
                      disabled
                      className="bg-slate-800/70 border-slate-700 text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Fecha de la clase" : "Data da aula"}</Label>
                    <Input
                      type="date"
                      value={editingLog.lesson_date}
                      onChange={(e) =>
                        setEditingLog((prev) =>
                          prev
                            ? {
                                ...prev,
                                lesson_date: normalizeLessonDate(e.target.value),
                              }
                            : prev,
                        )
                      }
                      onBlur={() =>
                        setEditingLog((prev) =>
                          prev
                            ? {
                                ...prev,
                                lesson_date: normalizeLessonDate(prev.lesson_date),
                              }
                            : prev,
                        )
                      }
                      className="bg-slate-800/70 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Bimestre" : "Bimestre"}</Label>
                    <select
                      value={editingLog.bimester}
                      onChange={(e) =>
                        setEditingLog((prev) =>
                          prev ? { ...prev, bimester: Number(e.target.value || 1) } : prev,
                        )
                      }
                      className="w-full h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">{isEs ? "Observaciones" : "Observacoes"}</Label>
                  <textarea
                    value={editingLog.observations}
                    onChange={(e) =>
                      setEditingLog((prev) =>
                        prev ? { ...prev, observations: e.target.value } : prev,
                      )
                    }
                    rows={4}
                    className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">{isEs ? "Notas" : "Anotacoes"}</Label>
                  <textarea
                    value={editingLog.notes}
                    onChange={(e) =>
                      setEditingLog((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                    }
                    rows={4}
                    className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => setEditingLog(null)}
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                  >
                    {isEs ? "Cancelar" : "Cancelar"}
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                    <Save className="w-4 h-4 mr-2" />
                    {isEs ? "Guardar" : "Salvar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {quickLaunchOpen && quickLaunchSchedule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => void requestCloseQuickLaunch()}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />
          <Card className="relative z-10 w-full max-w-6xl max-h-[92vh] overflow-hidden bg-slate-900/95 border border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {isEs ? "Lanzar clase" : "Lancar aula"} • {quickLaunchSchedule.class_label}
                </span>
                <Button
                  type="button"
                  onClick={() => void requestCloseQuickLaunch()}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  {isEs ? "Cerrar" : "Fechar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(92vh-78px)]">
              <form onSubmit={(e) => void submitQuickLaunch(e)} className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-white">{isEs ? "Turma" : "Turma"}</Label>
                    <Input
                      value={quickLaunchSchedule.class_label}
                      disabled
                      className="bg-slate-800/70 border-slate-700 text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Fecha de la clase" : "Data da aula"}</Label>
                    <Input
                      type="date"
                      value={quickLaunchDate}
                      onChange={(e) => setQuickLaunchDate(e.target.value)}
                      onBlur={() => {
                        if (!String(quickLaunchDate ?? "").trim()) {
                          setQuickLaunchDate(todayIsoDate())
                        }
                      }}
                      className="bg-slate-800/70 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Bimestre" : "Bimestre"}</Label>
                    <select
                      value={quickLaunchBimester}
                      onChange={(e) => setQuickLaunchBimester(Number(e.target.value || 1))}
                      className="w-full h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                  <div className="md:col-span-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm text-white cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-cyan-500"
                        checked={quickLaunchHasGrades}
                        onChange={(e) => setQuickLaunchHasGrades(e.target.checked)}
                      />
                      {isEs ? "Clase con nota" : "Aula com nota"}
                    </label>
                    <p className="text-xs text-slate-300 mt-1">
                      {quickLaunchHasGrades
                        ? isEs
                          ? "Se lanzan presencia y C1 a C4 para todos los alumnos."
                          : "Lanca presenca e C1 a C4 para todos os alunos."
                        : isEs
                          ? "Solo registra diario/observaciones. Esta clase cuenta como completa para cierre."
                          : "Registra apenas diario/observacoes. Esta aula conta como completa para fechamento."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Texto libre (diario)" : "Texto livre (diario)"}</Label>
                    <textarea
                      rows={3}
                      value={quickLaunchNotes}
                      onChange={(e) => setQuickLaunchNotes(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{isEs ? "Observaciones" : "Observacoes"}</Label>
                    <textarea
                      rows={3}
                      value={quickLaunchObservations}
                      onChange={(e) => setQuickLaunchObservations(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-sm text-slate-200">
                      {quickLaunchHasGrades
                        ? isEs
                          ? "Notas y asistencia por alumno"
                          : "Notas e presenca por aluno"
                        : isEs
                          ? "Clase sin nota en este dia"
                          : "Aula sem nota neste dia"}
                    </p>
                  </div>
                  {quickLaunchLoadingStudents ? (
                    <p className="p-3 text-sm text-slate-400">
                      {isEs ? "Cargando alumnos..." : "Carregando alunos..."}
                    </p>
                  ) : quickLaunchEntries.length === 0 ? (
                    <p className="p-3 text-sm text-slate-400">
                      {isEs ? "Sin alumnos activos." : "Sem alunos ativos."}
                    </p>
                  ) : !quickLaunchHasGrades ? (
                    <p className="p-3 text-sm text-slate-300">
                      {isEs
                        ? "No es necesario completar C1-C4 hoy. Puede guardar solo con el diario."
                        : "Nao e necessario preencher C1-C4 hoje. Pode salvar apenas com o diario."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <p className="px-3 pt-2 text-xs text-slate-300">
                        {isEs
                          ? "Atajo: Enter avanza C1 a C4 y al siguiente alumno. Flechas tambien navegan."
                          : "Atalho: Enter avanca C1 a C4 e para o proximo aluno. Setas tambem navegam."}
                      </p>
                      <table className="min-w-[900px] w-full text-sm">
                        <thead>
                          <tr className="text-slate-300 border-b border-white/10">
                            <th className="text-left py-2 px-3">{isEs ? "Alumno" : "Aluno"}</th>
                            <th className="text-left py-2 px-2">{isEs ? "Asistencia" : "Presenca"}</th>
                            <th className="text-left py-2 px-2">C1</th>
                            <th className="text-left py-2 px-2">C2</th>
                            <th className="text-left py-2 px-2">C3</th>
                            <th className="text-left py-2 px-2">C4</th>
                            <th className="text-left py-2 px-2">{isEs ? "Observacion" : "Observacao"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quickLaunchEntries.map((entry, rowIndex) => (
                            <tr key={entry.student_id} className="border-b border-white/10 last:border-b-0">
                              <td className="py-2 px-3 text-white max-w-[220px] truncate">{entry.full_name}</td>
                              <td className="py-2 px-2">
                                <label className="inline-flex items-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-cyan-500 cursor-pointer"
                                    checked={entry.attendance !== "absent"}
                                    onChange={(e) =>
                                      updateQuickLaunchEntry(entry.student_id, {
                                        attendance: e.target.checked ? "present" : "absent",
                                      })
                                    }
                                  />
                                </label>
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  ref={(el) => setQuickLaunchScoreInputRef(entry.student_id, "c1", el)}
                                  type="number"
                                  min={0}
                                  max={scoreMax}
                                  step={0.01}
                                  value={entry.c1 ?? ""}
                                  onChange={(e) =>
                                    updateQuickLaunchEntry(entry.student_id, {
                                      c1: parseNumericInput(e.target.value, scoreMax),
                                    })
                                  }
                                  onBlur={() => clampQuickLaunchEntryScore(entry.student_id, "c1", scoreMax)}
                                  onKeyDown={(e) => handleQuickLaunchScoreKeyDown(e, rowIndex, "c1")}
                                  className={scoreInputClass}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  ref={(el) => setQuickLaunchScoreInputRef(entry.student_id, "c2", el)}
                                  type="number"
                                  min={0}
                                  max={scoreMax}
                                  step={0.01}
                                  value={entry.c2 ?? ""}
                                  onChange={(e) =>
                                    updateQuickLaunchEntry(entry.student_id, {
                                      c2: parseNumericInput(e.target.value, scoreMax),
                                    })
                                  }
                                  onBlur={() => clampQuickLaunchEntryScore(entry.student_id, "c2", scoreMax)}
                                  onKeyDown={(e) => handleQuickLaunchScoreKeyDown(e, rowIndex, "c2")}
                                  className={scoreInputClass}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  ref={(el) => setQuickLaunchScoreInputRef(entry.student_id, "c3", el)}
                                  type="number"
                                  min={0}
                                  max={scoreMax}
                                  step={0.01}
                                  value={entry.c3 ?? ""}
                                  onChange={(e) =>
                                    updateQuickLaunchEntry(entry.student_id, {
                                      c3: parseNumericInput(e.target.value, scoreMax),
                                    })
                                  }
                                  onBlur={() => clampQuickLaunchEntryScore(entry.student_id, "c3", scoreMax)}
                                  onKeyDown={(e) => handleQuickLaunchScoreKeyDown(e, rowIndex, "c3")}
                                  className={scoreInputClass}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  ref={(el) => setQuickLaunchScoreInputRef(entry.student_id, "c4", el)}
                                  type="number"
                                  min={0}
                                  max={scoreMax}
                                  step={0.01}
                                  value={entry.c4 ?? ""}
                                  onChange={(e) =>
                                    updateQuickLaunchEntry(entry.student_id, {
                                      c4: parseNumericInput(e.target.value, scoreMax),
                                    })
                                  }
                                  onBlur={() => clampQuickLaunchEntryScore(entry.student_id, "c4", scoreMax)}
                                  onKeyDown={(e) => handleQuickLaunchScoreKeyDown(e, rowIndex, "c4")}
                                  className={scoreInputClass}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={entry.comment ?? ""}
                                  onChange={(e) =>
                                    updateQuickLaunchEntry(entry.student_id, {
                                      comment: e.target.value || null,
                                    })
                                  }
                                  className="h-8 bg-slate-800/80 border-slate-700 text-white text-xs"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pb-1">
                  <Button
                    type="button"
                    onClick={() => void requestCloseQuickLaunch()}
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                  >
                    {isEs ? "Cancelar" : "Cancelar"}
                  </Button>
                  <Button type="submit" disabled={quickLaunchSaving} className="bg-cyan-600 hover:bg-cyan-700">
                    <Save className="w-4 h-4 mr-2" />
                    {quickLaunchSaving
                      ? isEs
                        ? "Guardando..."
                        : "Salvando..."
                      : isEs
                        ? "Lanzar clase"
                        : "Lancar aula"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {exportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
          <button
            type="button"
            onClick={() => {
              if (exportingFormat) return
              setExportModalOpen(false)
              setPendingExportFormat("")
            }}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label={isEs ? "Cerrar" : "Fechar"}
          />
          <Card className="relative z-10 w-full max-w-md bg-slate-900/95 border border-white/10 text-white">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{isEs ? "Exportar turma" : "Exportar turma"}</span>
                <Button
                  type="button"
                  onClick={() => {
                    if (exportingFormat) return
                    setExportModalOpen(false)
                    setPendingExportFormat("")
                  }}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                  disabled={!!exportingFormat}
                >
                  <X className="w-4 h-4 mr-2" />
                  {isEs ? "Cerrar" : "Fechar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <p className="text-sm text-slate-200">
                  {selectedClass?.name ?? (isEs ? "Turma seleccionada" : "Turma selecionada")}
                </p>
                <p className="text-xs text-slate-400">
                  {pendingExportFormat === "pdf"
                    ? isEs
                      ? "Formato: PDF"
                      : "Formato: PDF"
                    : isEs
                      ? "Formato: XLSX"
                      : "Formato: XLSX"}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">{isEs ? "Bimestre para exportar" : "Bimestre para exportar"}</Label>
                <select
                  value={exportBimesterChoice}
                  onChange={(e) => setExportBimesterChoice(Number(e.target.value || 1))}
                  className="w-full h-10 rounded-md border border-slate-700 bg-slate-800/70 px-3 text-white"
                >
                  <option value={1}>{isEs ? "Bimestre 1" : "Bimestre 1"}</option>
                  <option value={2}>{isEs ? "Bimestre 2" : "Bimestre 2"}</option>
                  <option value={3}>{isEs ? "Bimestre 3" : "Bimestre 3"}</option>
                  <option value={4}>{isEs ? "Bimestre 4" : "Bimestre 4"}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (exportingFormat) return
                    setExportModalOpen(false)
                    setPendingExportFormat("")
                  }}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                  disabled={!!exportingFormat}
                >
                  {isEs ? "Cancelar" : "Cancelar"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void confirmExportFromModal()}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  disabled={!pendingExportFormat || !!exportingFormat}
                >
                  {exportingFormat
                    ? isEs
                      ? "Exportando..."
                      : "Exportando..."
                    : isEs
                      ? "Exportar"
                      : "Exportar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

