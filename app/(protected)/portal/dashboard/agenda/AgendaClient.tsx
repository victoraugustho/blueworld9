"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  RefreshCcw,
  Sunrise,
  Sunset,
  Trash2,
} from "lucide-react"
import type {
  AttendanceStatus,
  TeacherClassStudent,
  TeacherLessonLog,
  TeacherReminder,
  TeacherSchedule,
} from "@/app/types/portal"
import { getTimezoneLabel } from "@/lib/timezones"

type Locale = "pt-BR" | "es"

type LessonForm = {
  schedule_id: string
  class_id: string
  class_label: string
  lesson_date: string
  school_year: number
  bimester: number
  notes: string
  observations: string
}

type RegisterEntry = {
  student_id: string
  full_name: string
  attendance: AttendanceStatus
  c1: number | null
  c2: number | null
  c3: number | null
  c4: number | null
  comment: string
}

type ClassOption = {
  key: string
  label: string
  class_id: string | null
  schedule_id: string | null
  class_label: string | null
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function formatDate(value: unknown, locale: Locale) {
  if (!value) return "-"
  try {
    const normalized = normalizeDateInput(value)
    if (!normalized) return "-"
    const d = new Date(`${normalized}T00:00:00Z`)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString(locale === "es" ? "es-ES" : "pt-BR", { timeZone: "UTC" })
  } catch {
    return String(value)
  }
}

function normalizeDateInput(value: any) {
  if (!value) return ""
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/)
    if (match) return match[0]
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return ""
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

function parseScoreInput(value: string, max = 10) {
  const clean = value.replace(",", ".").trim()
  if (!clean) return null
  const parsed = Number(clean)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(max, Math.round(parsed * 100) / 100))
}

const scoreInputClass =
  "h-8 w-16 bg-slate-900/80 border border-white/10 rounded-md text-white text-center text-xs px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

type ScoreField = "c1" | "c2" | "c3" | "c4"
const scoreFieldOrder: ScoreField[] = ["c1", "c2", "c3", "c4"]

function formatDateTime(value: string | null | undefined, locale: Locale) {
  if (!value) return "-"
  try {
    const d = new Date(value)
    return d.toLocaleString(locale === "es" ? "es-ES" : "pt-BR")
  } catch {
    return value
  }
}

function previewText(value: string | null | undefined, max = 140) {
  if (!value) return ""
  const clean = String(value).trim()
  if (!clean) return ""
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}…`
}

function isTruncated(value: string | null | undefined, max = 140) {
  if (!value) return false
  const clean = String(value).trim()
  return clean.length > max
}

function timeToMinutes(value: string) {
  const [hRaw, mRaw] = String(value ?? "").split(":")
  const h = Number(hRaw ?? 0)
  const m = Number(mRaw ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return Math.max(0, h * 60 + m)
}

function getScheduleScopeKey(schedule: TeacherSchedule) {
  if (schedule.class_id) return `class:${schedule.class_id}`
  return `schedule:${schedule.id}`
}

function getLogScopeKey(log: TeacherLessonLog) {
  if (log.class_id) return `class:${log.class_id}`
  if (log.schedule_id) return `schedule:${log.schedule_id}`
  return `label:${log.class_label}`
}

function getReminderScopeKey(reminder: TeacherReminder) {
  if (reminder.class_id) return `class:${reminder.class_id}`
  if (reminder.schedule_id) return `schedule:${reminder.schedule_id}`
  if (reminder.class_label) return `label:${reminder.class_label}`
  return null
}

export default function AgendaClient({ locale }: { locale: Locale }) {
  const t = {
    title: locale === "es" ? "Agenda de Clases" : "Agenda de Aulas",
    schedules: locale === "es" ? "Horarios fijos" : "Horários fixos",
    noSchedules: locale === "es" ? "No hay horarios registrados." : "Nenhum horário cadastrado.",
    register: locale === "es" ? "Registrar clase" : "Registrar aula",
    selectSchedule:
      locale === "es"
        ? "Seleccione un horario para registrar la clase."
        : "Selecione um horário para registrar a aula.",
    nextLesson: locale === "es" ? "Próxima clase" : "Próxima aula",
    date: locale === "es" ? "Fecha" : "Data",
    notes: locale === "es" ? "Texto libre" : "Texto livre",
    observations: locale === "es" ? "Observaciones" : "Observações",
    save: locale === "es" ? "Guardar" : "Salvar",
    cancel: locale === "es" ? "Cancelar" : "Cancelar",
    diary: locale === "es" ? "Diario de clases" : "Diário de aulas",
    noLogs: locale === "es" ? "No hay registros." : "Nenhum registro encontrado.",
    edit: locale === "es" ? "Editar" : "Editar",
    view: locale === "es" ? "Ver" : "Visualizar",
    refresh: locale === "es" ? "Actualizar" : "Atualizar",
    loading: locale === "es" ? "Cargando..." : "Carregando...",
    dayEmpty: locale === "es" ? "Sin clases" : "Sem aulas",
    lessons: locale === "es" ? "clases" : "aulas",
    lesson: locale === "es" ? "Clase" : "Aula",
    expand: locale === "es" ? "Expandir" : "Expandir",
    collapse: locale === "es" ? "Recolher" : "Recolher",
    autoDate: locale === "es" ? "Fecha registrada automáticamente." : "Data registrada automaticamente.",
    registeringLesson: locale === "es" ? "Clase en registro" : "Aula em registro",
    reminderLabel: locale === "es" ? "Recordatorio" : "Lembrete",
    reminderClass: locale === "es" ? "Clase" : "Turma",
    reminderLesson: locale === "es" ? "Número de clase" : "Número da aula",
    reminderGeneral: locale === "es" ? "General" : "Geral",
    reminderLessonRequired:
      locale === "es" ? "Número de clase obligatorio" : "Número da aula obrigatório",
    reminderLessonInvalid:
      locale === "es" ? "Número de clase inválido" : "Número da aula inválido",
    reminderPast:
      locale === "es" ? "La clase informada ya pasó." : "A aula informada já passou.",
    reminderView: locale === "es" ? "Ver recordatorio" : "Ver lembrete",
    reminders: locale === "es" ? "Recordatorios" : "Lembretes",
    reminderEmpty: locale === "es" ? "Sin recordatorios." : "Nenhum lembrete.",
    reminderAdd: locale === "es" ? "Agregar recordatorio" : "Adicionar lembrete",
    reminderPlaceholder: locale === "es" ? "Escribe un recordatorio..." : "Escreva um lembrete...",
    reminderSave: locale === "es" ? "Guardar recordatorio" : "Salvar lembrete",
    reminderDone: locale === "es" ? "Completado" : "Concluído",
    reminderUndo: locale === "es" ? "Reabrir" : "Reabrir",
    reminderDelete: locale === "es" ? "Eliminar" : "Excluir",
    morningShift: locale === "es" ? "Matutino" : "Matutino",
    afternoonShift: locale === "es" ? "Vespertino" : "Vespertino",
    classTag: locale === "es" ? "Clase" : "Turma",
    eventTag: locale === "es" ? "Evento" : "Evento",
    recurringTag: locale === "es" ? "Semanal" : "Semanal",
    oneOffTag: locale === "es" ? "Puntual" : "Pontual",
    eventNoRegister:
      locale === "es"
        ? "Evento sin lanzamiento de notas."
        : "Evento sem lancamento de notas.",
    oneOffEvents: locale === "es" ? "Eventos puntuales" : "Eventos pontuais",
    noOneOffEvents:
      locale === "es" ? "Sin eventos puntuales." : "Nenhum evento pontual.",
    lessonDate: locale === "es" ? "Fecha de la clase" : "Data da aula",
    schoolYear: locale === "es" ? "Ano lectivo" : "Ano letivo",
    bimester: locale === "es" ? "Bimestre" : "Bimestre",
    students: locale === "es" ? "Alumnos" : "Alunos",
    loadingStudents: locale === "es" ? "Cargando alumnos..." : "Carregando alunos...",
    noStudents: locale === "es" ? "Sin alumnos activos en la clase." : "Sem alunos ativos na turma.",
    attendance: locale === "es" ? "Asistencia" : "Presenca",
    studentObservation: locale === "es" ? "Observacion" : "Observacao",
    classSummary: locale === "es" ? "Resumo da aula" : "Resumo da aula",
    scoreLegend:
      locale === "es"
        ? "C1 a C4: notas de 0 a 10 por alumno."
        : "C1 a C4: notas de 0 a 10 por aluno.",
  }
  const weekdayLabels = useMemo(
    () =>
      locale === "es"
        ? [
            "",
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado",
            "Domingo",
          ]
        : [
            "",
            "Segunda-feira",
            "Terça-feira",
            "Quarta-feira",
            "Quinta-feira",
            "Sexta-feira",
            "Sábado",
            "Domingo",
          ],
    [locale]
  )

  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [logs, setLogs] = useState<TeacherLessonLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({})
  const [reminders, setReminders] = useState<TeacherReminder[]>([])
  const [reminderText, setReminderText] = useState("")
  const [reminderTargetKey, setReminderTargetKey] = useState("")
  const [reminderLessonNumber, setReminderLessonNumber] = useState("")
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderSaving, setReminderSaving] = useState(false)
  const [reminderError, setReminderError] = useState("")
  const [viewReminder, setViewReminder] = useState<TeacherReminder | null>(null)

  const [form, setForm] = useState<LessonForm>({
    schedule_id: "",
    class_id: "",
    class_label: "",
    lesson_date: "",
    school_year: new Date().getFullYear(),
    bimester: 1,
    notes: "",
    observations: "",
  })

  const [registerSchedule, setRegisterSchedule] = useState<TeacherSchedule | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerEntries, setRegisterEntries] = useState<RegisterEntry[]>([])
  const [registerLoadingStudents, setRegisterLoadingStudents] = useState(false)
  const registerScoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [editing, setEditing] = useState<
    | {
        id: string
        class_label: string
        lesson_number: number
        lesson_date: string
        notes: string
        observations: string
      }
    | null
  >(null)
  const [viewing, setViewing] = useState<
    | {
        id: string
        class_label: string
        lesson_number: number
        lesson_date: string
        notes: string
        observations: string
      }
    | null
  >(null)

  function registerWithNumber(value: number) {
    return `${t.register} ${value}`
  }

  function registerScoreRefKey(studentId: string, field: ScoreField) {
    return `${studentId}:${field}`
  }

  function setRegisterScoreInputRef(studentId: string, field: ScoreField, el: HTMLInputElement | null) {
    registerScoreInputRefs.current[registerScoreRefKey(studentId, field)] = el
  }

  function focusRegisterScoreCell(rowIndex: number, field: ScoreField) {
    const row = registerEntries[rowIndex]
    if (!row) return
    const input = registerScoreInputRefs.current[registerScoreRefKey(row.student_id, field)]
    input?.focus()
    input?.select()
  }

  function handleRegisterScoreKeyDown(
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
      } else if (rowIndex < registerEntries.length - 1) {
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
      if (rowIndex >= registerEntries.length - 1) return
      targetRow = rowIndex + 1
    } else if (event.key === "ArrowUp") {
      if (rowIndex <= 0) return
      targetRow = rowIndex - 1
    } else {
      return
    }

    event.preventDefault()
    focusRegisterScoreCell(targetRow, scoreFieldOrder[targetCol])
  }

  async function load() {
    setLoading(true)
    try {
      const [sRes, lRes, rRes] = await Promise.all([
        fetch("/api/portal/teacher-schedules", { cache: "no-store" }),
        fetch("/api/portal/lesson-logs", { cache: "no-store" }),
        fetch("/api/portal/reminders", { cache: "no-store" }),
      ])
      const sData = await sRes.json()
      const lData = await lRes.json()
      const rData = await rRes.json()
      setSchedules(Array.isArray(sData) ? sData : [])
      const normalizedLogs = Array.isArray(lData)
        ? lData.map((log) => ({ ...log, lesson_date: normalizeDateInput(log.lesson_date) }))
        : []
      setLogs(normalizedLogs)
      setReminders(Array.isArray(rData) ? rData : [])
    } finally {
      setLoading(false)
    }
  }

  async function loadReminders() {
    const res = await fetch("/api/portal/reminders", { cache: "no-store" })
    const data = await res.json()
    setReminders(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    load()
  }, [])

  const nextByScope = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of logs) {
      const scopeKey = getLogScopeKey(log)
      const current = map.get(scopeKey) ?? 0
      if (log.lesson_number > current) map.set(scopeKey, log.lesson_number)
    }
    const nextMap = new Map<string, number>()
    for (const schedule of schedules) {
      const scopeKey = getScheduleScopeKey(schedule)
      const last = map.get(scopeKey) ?? 0
      nextMap.set(scopeKey, last + 1)
    }
    for (const [scopeKey, last] of map.entries()) {
      if (!nextMap.has(scopeKey)) nextMap.set(scopeKey, last + 1)
    }
    return nextMap
  }, [logs, schedules])

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; items: TeacherLessonLog[] }>()
    for (const log of logs) {
      const key = getLogScopeKey(log)
      const current = groups.get(key) ?? {
        key,
        label: String(log.class_label ?? "").trim() || "Turma",
        items: [],
      }
      current.items.push(log)
      groups.set(key, current)
    }
    const list = Array.from(groups.values())
    for (const group of list) {
      group.items.sort((a, b) => b.lesson_number - a.lesson_number)
    }
    list.sort((a, b) => a.label.localeCompare(b.label))
    return list
  }, [logs])

  const schedulesByWeekday = useMemo(() => {
    const map: Record<number, TeacherSchedule[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }
    for (const schedule of schedules) {
      if (schedule.is_recurring === false) continue
      if (map[schedule.weekday]) map[schedule.weekday].push(schedule)
    }
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => timeLabel(a.start_time).localeCompare(timeLabel(b.start_time)))
    }
    return map
  }, [schedules])

  const oneOffEvents = useMemo(
    () =>
      schedules
        .filter((schedule) => schedule.entry_type === "event" && schedule.is_recurring === false)
        .sort((a, b) => {
          const da = String(a.event_date ?? "")
          const db = String(b.event_date ?? "")
          const dateCompare = da.localeCompare(db)
          if (dateCompare !== 0) return dateCompare
          return timeLabel(a.start_time).localeCompare(timeLabel(b.start_time))
        }),
    [schedules],
  )

  const classOptions = useMemo<ClassOption[]>(() => {
    const map = new Map<string, ClassOption>()
    for (const schedule of schedules) {
      if (schedule.entry_type === "event") continue
      const key = getScheduleScopeKey(schedule)
      if (map.has(key)) continue
      const weekday = weekdayLabels[schedule.weekday] ?? String(schedule.weekday)
      const label =
        schedule.class_id
          ? schedule.class_label
          : `${schedule.class_label} - ${weekday} ${timeLabel(schedule.start_time)}-${timeLabel(schedule.end_time)}`
      map.set(key, {
        key,
        label: String(label ?? "").trim(),
        class_id: schedule.class_id ? String(schedule.class_id) : null,
        schedule_id: schedule.class_id ? null : schedule.id,
        class_label: schedule.class_label ?? null,
      })
    }
    for (const log of logs) {
      const key = getLogScopeKey(log)
      if (map.has(key)) continue
      map.set(key, {
        key,
        label: String(log.class_label ?? "").trim() || "Turma",
        class_id: log.class_id ? String(log.class_id) : null,
        schedule_id: !log.class_id && log.schedule_id ? String(log.schedule_id) : null,
        class_label: log.class_label ?? null,
      })
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [schedules, logs, weekdayLabels])

  const classOptionByKey = useMemo(() => {
    const map = new Map<string, ClassOption>()
    for (const option of classOptions) map.set(option.key, option)
    return map
  }, [classOptions])

  const reminderByLesson = useMemo(() => {
    const map = new Map<string, TeacherReminder>()
    const active = reminders
      .filter((item) => !item.done && item.lesson_number)
      .sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0
        return bd - ad
      })
    for (const reminder of active) {
      const scopeKey = getReminderScopeKey(reminder)
      if (!scopeKey) continue
      const key = `${scopeKey}::${reminder.lesson_number}`
      if (!map.has(key)) map.set(key, reminder)
    }
    return map
  }, [reminders])

  async function loadRegisterStudents(classId: string) {
    if (!classId) {
      setRegisterEntries([])
      return
    }
    setRegisterLoadingStudents(true)
    try {
      const [classRes, studentsRes] = await Promise.all([
        fetch(`/api/portal/gradebook/classes/${classId}`, { cache: "no-store" }),
        fetch(`/api/portal/gradebook/classes/${classId}/students`, { cache: "no-store" }),
      ])
      const classData = await classRes.json().catch(() => null)
      const studentsData = await studentsRes.json().catch(() => [])
      const students: TeacherClassStudent[] = Array.isArray(studentsData) ? studentsData : []
      const activeStudents = students.filter((student) => student.active !== false)
      if (classData && typeof classData === "object") {
        setForm((prev) => ({
          ...prev,
          class_label: String((classData as any).name ?? prev.class_label),
          school_year: Number((classData as any).school_year ?? prev.school_year),
        }))
      }
      setRegisterEntries(
        activeStudents.map((student) => ({
          student_id: student.id,
          full_name: student.full_name,
          attendance: "present",
          c1: null,
          c2: null,
          c3: null,
          c4: null,
          comment: "",
        })),
      )
    } catch {
      setRegisterEntries([])
      setError(locale === "es" ? "Error al cargar alumnos." : "Erro ao carregar alunos.")
    } finally {
      setRegisterLoadingStudents(false)
    }
  }

  async function startRegister(schedule: TeacherSchedule) {
    if (schedule.entry_type === "event" || !schedule.class_id) return
    const lessonDate = getTodayInTimeZone(schedule.timezone)
    setForm({
      schedule_id: schedule.id,
      class_id: schedule.class_id ? String(schedule.class_id) : "",
      class_label: schedule.class_label,
      lesson_date: lessonDate,
      school_year: new Date().getFullYear(),
      bimester: 1,
      notes: "",
      observations: "",
    })
    setRegisterSchedule(schedule)
    setRegisterOpen(true)
    setEditing(null)
    setError("")
    await loadRegisterStudents(String(schedule.class_id))
  }

  function resetForm() {
    setForm({
      schedule_id: "",
      class_id: "",
      class_label: "",
      lesson_date: "",
      school_year: new Date().getFullYear(),
      bimester: 1,
      notes: "",
      observations: "",
    })
    setRegisterEntries([])
    setRegisterLoadingStudents(false)
    setError("")
  }

  function updateRegisterEntry(studentId: string, patch: Partial<RegisterEntry>) {
    setRegisterEntries((prev) =>
      prev.map((entry) => (entry.student_id === studentId ? { ...entry, ...patch } : entry)),
    )
  }

  function clampRegisterScore(studentId: string, field: "c1" | "c2" | "c3" | "c4", max = 10) {
    setRegisterEntries((prev) =>
      prev.map((entry) => {
        if (entry.student_id !== studentId) return entry
        const value = entry[field]
        if (value === null || value === undefined) return entry
        const clamped = parseScoreInput(String(value), max)
        if (clamped === value) return entry
        return { ...entry, [field]: clamped }
      }),
    )
  }

  function toggleClass(label: string) {
    setOpenClasses((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  function handleReminderClassChange(value: string) {
    setReminderTargetKey(value)
    if (!value) {
      setReminderLessonNumber("")
      return
    }
    const nextLesson = nextByScope.get(value) ?? 1
    setReminderLessonNumber(String(nextLesson))
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.schedule_id && !form.class_id && !form.class_label) return
    setSaving(true)
    setError("")
    const lessonDate = normalizeDateInput(form.lesson_date) || getTodayInTimeZone(registerSchedule?.timezone ?? "UTC")

    const res = await fetch("/api/portal/lesson-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        lesson_date: lessonDate,
        school_year: form.school_year,
        bimester: form.bimester,
        entries: registerEntries.map((entry) => ({
          student_id: entry.student_id,
          attendance: entry.attendance,
          c1: entry.c1,
          c2: entry.c2,
          c3: entry.c3,
          c4: entry.c4,
          comment: entry.comment.trim() || null,
        })),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err?.error ?? "Erro ao salvar")
      setSaving(false)
      return
    }

    setRegisterOpen(false)
    setRegisterSchedule(null)
    resetForm()
    await load()
    setSaving(false)
  }

  function startEdit(log: TeacherLessonLog) {
    setError("")
    setViewing(null)
    setEditing({
      id: log.id,
      class_label: log.class_label,
      lesson_number: log.lesson_number,
      lesson_date: normalizeDateInput(log.lesson_date),
      notes: log.notes ?? "",
      observations: log.observations ?? "",
    })
  }

  function startView(log: TeacherLessonLog) {
    setError("")
    setEditing(null)
    setViewing({
      id: log.id,
      class_label: log.class_label,
      lesson_number: log.lesson_number,
      lesson_date: normalizeDateInput(log.lesson_date),
      notes: log.notes ?? "",
      observations: log.observations ?? "",
    })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setError("")

    const res = await fetch(`/api/portal/lesson-logs/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: editing.notes,
        observations: editing.observations,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err?.error ?? "Erro ao salvar")
      setSaving(false)
      return
    }

    setEditing(null)
    await load()
    setSaving(false)
  }

  async function submitReminder(e: React.FormEvent) {
    e.preventDefault()
    const content = reminderText.trim()
    if (!content) {
      setReminderError(t.reminderPlaceholder)
      return
    }
    const selectedClass = classOptionByKey.get(reminderTargetKey) ?? null
    const lessonRaw = reminderLessonNumber.trim()
    const lessonNumber = lessonRaw ? Number(lessonRaw) : null
    if (selectedClass && !lessonRaw) {
      setReminderError(t.reminderLessonRequired)
      return
    }
    if (lessonNumber !== null && (!Number.isInteger(lessonNumber) || lessonNumber <= 0)) {
      setReminderError(t.reminderLessonInvalid)
      return
    }
    if (selectedClass && lessonNumber !== null) {
      const nextLesson = nextByScope.get(selectedClass.key) ?? 1
      if (lessonNumber < nextLesson) {
        setReminderError(t.reminderPast)
        return
      }
    }
    setReminderSaving(true)
    setReminderError("")

    const res = await fetch("/api/portal/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        class_label: selectedClass?.class_label ?? null,
        class_id: selectedClass?.class_id ?? null,
        schedule_id: selectedClass?.schedule_id ?? null,
        lesson_number: lessonNumber,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setReminderError(err?.error ?? "Erro ao salvar")
      setReminderSaving(false)
      return
    }

    setReminderText("")
    setReminderTargetKey("")
    setReminderLessonNumber("")
    setReminderOpen(false)
    await loadReminders()
    setReminderSaving(false)
  }

  async function toggleReminder(reminder: TeacherReminder) {
    const res = await fetch(`/api/portal/reminders/${reminder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !reminder.done }),
    })
    if (!res.ok) return
    const updated = await res.json().catch(() => null)
    if (!updated) return
    setReminders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  async function deleteReminder(reminder: TeacherReminder) {
    const res = await fetch(`/api/portal/reminders/${reminder.id}`, { method: "DELETE" })
    if (!res.ok) return
    setReminders((prev) => prev.filter((item) => item.id !== reminder.id))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-300" />
            {t.title}
          </h1>
        </div>
        <Button
          onClick={load}
          className="bg-white/10 hover:bg-white/15 border border-white/10"
          disabled={loading}
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t.refresh}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-slate-900/30 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">{t.schedules}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-slate-400">{t.loading}</p>}
            {!loading && schedules.length === 0 && <p className="text-slate-400">{t.noSchedules}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((day) => {
                const list = schedulesByWeekday[day] ?? []
                const weekday = weekdayLabels[day] ?? day
                const morningList = list.filter((schedule) => timeToMinutes(schedule.start_time) < 12 * 60)
                const afternoonList = list.filter((schedule) => timeToMinutes(schedule.start_time) >= 12 * 60)
                const periodSections = [
                  {
                    key: "morning",
                    label: t.morningShift,
                    items: morningList,
                    Icon: Sunrise,
                    panelClass: "border-amber-400/35 bg-amber-500/15",
                    chipClass:
                      "text-amber-50 bg-amber-500/35 border border-amber-300/40",
                    countClass: "text-amber-100/90",
                    emptyClass: "text-amber-100/75",
                    cardClass: "border-amber-300/35 bg-amber-500/10",
                    shiftBadgeClass:
                      "text-amber-100 bg-amber-500/20 border border-amber-300/35",
                    timeChipClass:
                      "text-amber-100 bg-amber-500/20 border border-amber-300/35",
                    actionClass:
                      "bg-amber-600 hover:bg-amber-700 text-amber-50",
                  },
                  {
                    key: "afternoon",
                    label: t.afternoonShift,
                    items: afternoonList,
                    Icon: Sunset,
                    panelClass: "border-sky-400/35 bg-sky-500/15",
                    chipClass:
                      "text-sky-50 bg-sky-500/35 border border-sky-300/40",
                    countClass: "text-sky-100/90",
                    emptyClass: "text-sky-100/75",
                    cardClass: "border-sky-300/35 bg-sky-500/10",
                    shiftBadgeClass:
                      "text-sky-100 bg-sky-500/20 border border-sky-300/35",
                    timeChipClass:
                      "text-sky-100 bg-sky-500/20 border border-sky-300/35",
                    actionClass:
                      "bg-sky-600 hover:bg-sky-700 text-sky-50",
                  },
                ]
                return (
                  <div key={day} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="px-2.5 py-1.5 border-b border-white/10 text-[11px] font-semibold text-white/80">
                      {weekday}
                    </div>
                    <div className="p-2.5 space-y-2">
                      {list.length === 0 && (
                        <p className="text-xs text-slate-400">{t.dayEmpty}</p>
                      )}
                      {list.length > 0 &&
                        periodSections.map((section) => (
                          <div key={section.key} className={`rounded-xl border p-2 space-y-1.5 ${section.panelClass}`}>
                            <div className="flex items-center justify-between gap-2 px-0.5">
                              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${section.chipClass}`}>
                                <section.Icon className="w-3 h-3" />
                                {section.label}
                              </span>
                              <span className={`text-[10px] font-semibold ${section.countClass}`}>
                                {section.items.length} {t.lessons}
                              </span>
                            </div>
                            {section.items.length === 0 ? (
                              <p className={`px-2 pb-1 text-xs ${section.emptyClass}`}>{t.dayEmpty}</p>
                            ) : (
                              <div className="space-y-2">
                                {section.items.map((schedule) => {
                                  const scopeKey = getScheduleScopeKey(schedule)
                                  const nextLesson = nextByScope.get(scopeKey) ?? 1
                                  const reminderKey = `${scopeKey}::${nextLesson}`
                                  const reminderForLesson = reminderByLesson.get(reminderKey)
                                  const reminderPreviewMax = 80
                                  const isEvent = schedule.entry_type === "event"
                                  return (
                                    <div key={schedule.id} className={`rounded-lg border p-2 ${section.cardClass}`}>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="text-xs font-semibold text-white truncate max-w-[14rem] sm:max-w-none">
                                          {schedule.class_label}
                                        </p>
                                        <span
                                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                            isEvent
                                              ? "text-amber-100 bg-amber-500/20 border-amber-400/30"
                                              : "text-cyan-100 bg-cyan-500/20 border-cyan-500/30"
                                          }`}
                                        >
                                          {isEvent ? t.eventTag : t.classTag}
                                        </span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${section.shiftBadgeClass}`}>
                                          {section.label}
                                        </span>
                                        {!isEvent && (
                                          <span className="text-[10px] font-semibold text-emerald-200 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                                            {t.lesson} {nextLesson}
                                          </span>
                                        )}
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${section.timeChipClass}`}>
                                          {timeLabel(schedule.start_time)} - {timeLabel(schedule.end_time)}
                                        </span>
                                      </div>
                                      {schedule.is_recurring === false && (
                                        <div className="mt-2 text-xs text-white/70">
                                          {t.date}: {formatDate(String(schedule.event_date ?? ""), locale)}
                                        </div>
                                      )}
                                      {!isEvent && reminderForLesson && (
                                        <div className="mt-2 text-xs text-amber-200 space-y-1">
                                          <p>
                                            {t.reminderLabel}:{" "}
                                            {previewText(reminderForLesson.content, reminderPreviewMax)}
                                          </p>
                                          {isTruncated(reminderForLesson.content, reminderPreviewMax) && (
                                            <button
                                              type="button"
                                              onClick={() => setViewReminder(reminderForLesson)}
                                              className="text-[11px] text-amber-100 underline underline-offset-2"
                                            >
                                              {t.reminderView}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {isEvent ? (
                                        <p className="mt-3 text-xs text-white/70">{t.eventNoRegister}</p>
                                      ) : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => startRegister(schedule)}
                                          className={`mt-2 h-7 px-2 text-[11px] ${section.actionClass}`}
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                          {registerWithNumber(nextLesson)}
                                        </Button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/30 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">{t.oneOffEvents}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {oneOffEvents.length === 0 && <p className="text-slate-400 text-sm">{t.noOneOffEvents}</p>}
            {oneOffEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{event.class_label}</p>
                  <p className="text-xs text-white/60">
                    {formatDate(String(event.event_date ?? ""), locale)} • {timeLabel(event.start_time)} - {timeLabel(event.end_time)}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-amber-100 bg-amber-500/20 border-amber-400/30">
                    {t.eventTag}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-amber-100/90 bg-amber-500/10 border-amber-300/20">
                    {t.oneOffTag}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/30 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">{t.diary}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && !loading && <p className="text-slate-400">{t.noLogs}</p>}

          <div className="space-y-6">
            {groupedLogs.map((group) => (
                <section key={group.key} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleClass(group.key)}
                    aria-expanded={openClasses[group.key] === true}
                    className="group w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-cyan-400/40 transition px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-white/15 bg-slate-900/50 text-cyan-300">
                          {openClasses[group.key] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </span>
                        <h3 className="text-sm font-semibold text-white truncate">{group.label}</h3>
                        <span className="text-[11px] text-white/60 border border-white/10 rounded-full px-2 py-0.5 whitespace-nowrap">
                          {group.items.length} {t.lessons}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-cyan-200/90 whitespace-nowrap">
                        {openClasses[group.key] ? t.collapse : t.expand}
                      </span>
                    </div>
                  </button>

                  {openClasses[group.key] && (
                    <div className="space-y-3">
                      {group.items.map((log) => (
                        <div key={log.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{`${t.lesson} ${log.lesson_number}`}</p>
                                <p className="text-xs text-white/60">{formatDate(log.lesson_date, locale)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startView(log)}
                                  className="inline-flex items-center gap-1 text-xs rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 px-2 py-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {t.view}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEdit(log)}
                                  className="inline-flex items-center gap-1 text-xs rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-200 px-2 py-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  {t.edit}
                                </button>
                              </div>
                            </div>

                            {log.notes && (
                              <div>
                                <p className="text-[11px] text-white/50">{t.notes}</p>
                                <p className="text-sm text-white/80 whitespace-pre-wrap">
                                  {previewText(log.notes)}
                                </p>
                              </div>
                            )}
                            {log.observations && (
                              <div>
                                <p className="text-[11px] text-white/50">{t.observations}</p>
                                <p className="text-sm text-white/60 whitespace-pre-wrap">
                                  {previewText(log.observations)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/30 border border-white/10">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-300" />
            {t.reminders}
          </CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setReminderError("")
              setReminderText("")
              setReminderTargetKey("")
              setReminderLessonNumber("")
              setReminderOpen(true)
            }}
            className="bg-white/10 hover:bg-white/15 border border-white/10"
          >
            {t.reminderAdd}
          </Button>
        </CardHeader>
        <CardContent>
          {loading && reminders.length === 0 && <p className="text-slate-400">{t.loading}</p>}
          {!loading && reminders.length === 0 && <p className="text-slate-400">{t.reminderEmpty}</p>}

          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    {reminder.class_label && reminder.lesson_number ? (
                      <span className="inline-flex items-center text-[11px] text-white/70 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">
                        {reminder.class_label} • {t.lesson} {reminder.lesson_number}
                      </span>
                    ) : null}
                    <p
                      className={`text-sm whitespace-pre-wrap ${
                        reminder.done ? "text-white/50 line-through" : "text-white"
                      }`}
                    >
                      {reminder.content}
                    </p>
                    <p className="text-[11px] text-white/50">
                      {formatDateTime(reminder.created_at, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleReminder(reminder)}
                      className="inline-flex items-center gap-1 text-xs rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 px-2 py-1"
                    >
                      {reminder.done ? t.reminderUndo : t.reminderDone}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReminder(reminder)}
                      className="inline-flex items-center gap-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200 px-2 py-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.reminderDelete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {viewReminder && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setViewReminder(null)
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{t.reminderView}</p>
                {viewReminder.class_label && viewReminder.lesson_number ? (
                  <p className="text-xs text-white/60 truncate">
                    {viewReminder.class_label} • {t.lesson} {viewReminder.lesson_number}
                  </p>
                ) : (
                  <p className="text-xs text-white/60">{t.reminderGeneral}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewReminder(null)}
                className="text-xs text-white/60 hover:text-white"
              >
                {t.cancel}
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-white whitespace-pre-wrap">{viewReminder.content}</p>
              <p className="text-xs text-white/50">
                {formatDateTime(viewReminder.created_at, locale)}
              </p>
            </div>
          </div>
        </div>
      )}

      {reminderOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setReminderOpen(false)
              setReminderError("")
              setReminderText("")
              setReminderTargetKey("")
              setReminderLessonNumber("")
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{t.reminderAdd}</p>
                <p className="text-xs text-white/60">{t.reminders}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReminderOpen(false)
                  setReminderError("")
                  setReminderText("")
                  setReminderTargetKey("")
                  setReminderLessonNumber("")
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                {t.cancel}
              </button>
            </div>

            <form onSubmit={submitReminder} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">{t.reminderClass}</label>
                  <select
                    value={reminderTargetKey}
                    onChange={(e) => handleReminderClassChange(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  >
                    <option value="">{t.reminderGeneral}</option>
                    {classOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">{t.reminderLesson}</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={reminderLessonNumber}
                    onChange={(e) => setReminderLessonNumber(e.target.value)}
                    disabled={!reminderTargetKey}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">
                  {locale === "es" ? "Recordatorio" : "Lembrete"}
                </label>
                <textarea
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  rows={4}
                  placeholder={t.reminderPlaceholder}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                />
              </div>

              {reminderError && <p className="text-xs text-rose-300">{reminderError}</p>}

              <div className="flex gap-2">
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={reminderSaving}>
                  {t.reminderSave}
                </Button>
                <Button
                  type="button"
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                  onClick={() => {
                    setReminderOpen(false)
                    setReminderError("")
                    setReminderText("")
                    setReminderTargetKey("")
                    setReminderLessonNumber("")
                  }}
                >
                  {t.cancel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {registerOpen && registerSchedule && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setRegisterOpen(false)
              setRegisterSchedule(null)
              resetForm()
            }
          }}
        >
          <div className="w-full max-w-6xl rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{t.register}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs text-white/60 truncate">{registerSchedule.class_label}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-cyan-100 bg-cyan-500/20 border-cyan-500/30">
                    {t.classTag}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-white/80 bg-white/10 border-white/15">
                    {t.recurringTag}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRegisterOpen(false)
                  setRegisterSchedule(null)
                  resetForm()
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                {t.cancel}
              </button>
            </div>

            <form onSubmit={submitForm} className="p-4 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 space-y-1">
                <div>
                  {weekdayLabels[registerSchedule.weekday] ?? registerSchedule.weekday} •{" "}
                  {timeLabel(registerSchedule.start_time)} - {timeLabel(registerSchedule.end_time)}
                </div>
                <div>{getTimezoneLabel(registerSchedule.timezone)}</div>
                <div>
                  <span className="text-white/60">{t.registeringLesson}</span>
                  <span className="text-white font-semibold bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full ml-2">
                    {nextByScope.get(getScheduleScopeKey(registerSchedule)) ?? 1}
                  </span>
                </div>
                <div className="text-[11px] text-white/50">{t.scoreLegend}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">{t.lessonDate}</label>
                  <input
                    type="date"
                    value={form.lesson_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, lesson_date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">{t.schoolYear}</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={form.school_year}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        school_year: Number(e.target.value || new Date().getFullYear()),
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">{t.bimester}</label>
                  <select
                    value={form.bimester}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, bimester: Number(e.target.value) }))
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400 mb-2">{t.students}</p>
                {registerLoadingStudents ? (
                  <p className="text-sm text-slate-300">{t.loadingStudents}</p>
                ) : registerEntries.length === 0 ? (
                  <p className="text-sm text-slate-400">{t.noStudents}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <p className="mb-2 text-xs text-slate-300">
                      {locale === "es"
                        ? "Atajo: Enter avanza C1 a C4 y al siguiente alumno. Flechas tambien navegan."
                        : "Atalho: Enter avanca C1 a C4 e para o proximo aluno. Setas tambem navegam."}
                    </p>
                    <table className="min-w-[760px] w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-slate-300 border-b border-white/10">
                          <th className="text-left py-2 pr-2">{t.students}</th>
                          <th className="text-left py-2 pr-2">{t.attendance}</th>
                          <th className="text-left py-2 pr-2">C1</th>
                          <th className="text-left py-2 pr-2">C2</th>
                          <th className="text-left py-2 pr-2">C3</th>
                          <th className="text-left py-2 pr-2">C4</th>
                          <th className="text-left py-2 pr-2">{t.studentObservation}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registerEntries.map((entry, rowIndex) => (
                          <tr key={entry.student_id} className="border-b border-white/10 last:border-b-0">
                            <td className="py-2 pr-2 text-white max-w-[220px] truncate">{entry.full_name}</td>
                            <td className="py-2 pr-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-cyan-500 cursor-pointer"
                                checked={entry.attendance !== "absent"}
                                onChange={(e) => {
                                  const attendance = e.target.checked ? "present" : "absent"
                                  updateRegisterEntry(entry.student_id, {
                                    attendance,
                                    ...(attendance === "absent"
                                      ? { c1: null, c2: null, c3: null, c4: null }
                                      : {}),
                                  })
                                }}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                ref={(el) => setRegisterScoreInputRef(entry.student_id, "c1", el)}
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                disabled={entry.attendance === "absent"}
                                value={entry.c1 ?? ""}
                                onChange={(e) =>
                                  updateRegisterEntry(entry.student_id, {
                                    c1: parseScoreInput(e.target.value, 10),
                                  })
                                }
                                onBlur={() => clampRegisterScore(entry.student_id, "c1", 10)}
                                onKeyDown={(e) => handleRegisterScoreKeyDown(e, rowIndex, "c1")}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                ref={(el) => setRegisterScoreInputRef(entry.student_id, "c2", el)}
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                disabled={entry.attendance === "absent"}
                                value={entry.c2 ?? ""}
                                onChange={(e) =>
                                  updateRegisterEntry(entry.student_id, {
                                    c2: parseScoreInput(e.target.value, 10),
                                  })
                                }
                                onBlur={() => clampRegisterScore(entry.student_id, "c2", 10)}
                                onKeyDown={(e) => handleRegisterScoreKeyDown(e, rowIndex, "c2")}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                ref={(el) => setRegisterScoreInputRef(entry.student_id, "c3", el)}
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                disabled={entry.attendance === "absent"}
                                value={entry.c3 ?? ""}
                                onChange={(e) =>
                                  updateRegisterEntry(entry.student_id, {
                                    c3: parseScoreInput(e.target.value, 10),
                                  })
                                }
                                onBlur={() => clampRegisterScore(entry.student_id, "c3", 10)}
                                onKeyDown={(e) => handleRegisterScoreKeyDown(e, rowIndex, "c3")}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                ref={(el) => setRegisterScoreInputRef(entry.student_id, "c4", el)}
                                type="number"
                                min={0}
                                max={10}
                                step={0.01}
                                disabled={entry.attendance === "absent"}
                                value={entry.c4 ?? ""}
                                onChange={(e) =>
                                  updateRegisterEntry(entry.student_id, {
                                    c4: parseScoreInput(e.target.value, 10),
                                  })
                                }
                                onBlur={() => clampRegisterScore(entry.student_id, "c4", 10)}
                                onKeyDown={(e) => handleRegisterScoreKeyDown(e, rowIndex, "c4")}
                                className={scoreInputClass}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                value={entry.comment}
                                onChange={(e) =>
                                  updateRegisterEntry(entry.student_id, { comment: e.target.value })
                                }
                                placeholder={t.studentObservation}
                                className="w-full px-2 py-1 rounded-md bg-slate-900/80 border border-white/10 text-white"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">{t.classSummary}</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">{t.observations}</label>
                  <textarea
                    value={form.observations}
                    onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-rose-300">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700"
                  disabled={saving || registerLoadingStudents}
                >
                  {t.save}
                </Button>
                <Button
                  type="button"
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                  onClick={() => {
                    setRegisterOpen(false)
                    setRegisterSchedule(null)
                    resetForm()
                  }}
                >
                  {t.cancel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setViewing(null)
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{`${viewing.class_label} • ${t.lesson} ${viewing.lesson_number}`}</p>
                <p className="text-xs text-white/60">{formatDate(viewing.lesson_date, locale)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewing(null)
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                {t.cancel}
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-xs text-white/50">
                {t.date}: {formatDate(viewing.lesson_date, locale)}
              </div>

              {viewing.notes && (
                <div>
                  <p className="text-xs text-slate-400">{t.notes}</p>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{viewing.notes}</p>
                </div>
              )}

              {viewing.observations && (
                <div>
                  <p className="text-xs text-slate-400">{t.observations}</p>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{viewing.observations}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setEditing(null)
              setError("")
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{`${editing.class_label} • ${t.lesson} ${editing.lesson_number}`}</p>
                <p className="text-xs text-white/60">{formatDate(editing.lesson_date, locale)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setError("")
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                {t.cancel}
              </button>
            </div>

            <form onSubmit={submitEdit} className="p-4 space-y-4">
              <div className="text-xs text-white/50">{t.date}: {formatDate(editing.lesson_date, locale)}</div>

              <div>
                <label className="text-xs text-slate-400">{t.notes}</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                  }
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">{t.observations}</label>
                <textarea
                  value={editing.observations}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, observations: e.target.value } : prev))
                  }
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                />
              </div>

              {error && <p className="text-xs text-rose-300">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={saving}>
                  {t.save}
                </Button>
                <Button
                  type="button"
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                  onClick={() => {
                    setEditing(null)
                    setError("")
                  }}
                >
                  {t.cancel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
