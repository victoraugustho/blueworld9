"use client"

import { useEffect, useMemo, useState } from "react"
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
  Trash2,
} from "lucide-react"
import type { TeacherLessonLog, TeacherReminder, TeacherSchedule } from "@/app/types/portal"
import { getTimezoneLabel } from "@/lib/timezones"

type Locale = "pt-BR" | "es"

type LessonForm = {
  schedule_id: string
  class_label: string
  notes: string
  observations: string
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function formatDate(value: string, locale: Locale) {
  if (!value) return "-"
  try {
    const d = new Date(`${value}T00:00:00Z`)
    return d.toLocaleDateString(locale === "es" ? "es-ES" : "pt-BR", { timeZone: "UTC" })
  } catch {
    return value
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
  const [reminderClassLabel, setReminderClassLabel] = useState("")
  const [reminderLessonNumber, setReminderLessonNumber] = useState("")
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderSaving, setReminderSaving] = useState(false)
  const [reminderError, setReminderError] = useState("")
  const [viewReminder, setViewReminder] = useState<TeacherReminder | null>(null)

  const [form, setForm] = useState<LessonForm>({
    schedule_id: "",
    class_label: "",
    notes: "",
    observations: "",
  })

  const [registerSchedule, setRegisterSchedule] = useState<TeacherSchedule | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
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

  const nextByClass = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of logs) {
      const current = map.get(log.class_label) ?? 0
      if (log.lesson_number > current) map.set(log.class_label, log.lesson_number)
    }
    const nextMap = new Map<string, number>()
    for (const schedule of schedules) {
      const last = map.get(schedule.class_label) ?? 0
      nextMap.set(schedule.class_label, last + 1)
    }
    for (const [label, last] of map.entries()) {
      if (!nextMap.has(label)) nextMap.set(label, last + 1)
    }
    return nextMap
  }, [logs, schedules])

  const groupedLogs = useMemo(() => {
    const groups: Record<string, TeacherLessonLog[]> = {}
    for (const log of logs) {
      if (!groups[log.class_label]) groups[log.class_label] = []
      groups[log.class_label].push(log)
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => b.lesson_number - a.lesson_number)
    }
    return groups
  }, [logs])

  useEffect(() => {
    if (Object.keys(openClasses).length > 0) return
    const keys = Object.keys(groupedLogs)
    if (keys.length === 0) return
    setOpenClasses({ [keys.sort((a, b) => a.localeCompare(b))[0]]: true })
  }, [groupedLogs, openClasses])

  const schedulesByWeekday = useMemo(() => {
    const map: Record<number, TeacherSchedule[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    for (const schedule of schedules) {
      if (map[schedule.weekday]) map[schedule.weekday].push(schedule)
    }
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => timeLabel(a.start_time).localeCompare(timeLabel(b.start_time)))
    }
    return map
  }, [schedules])

  const classOptions = useMemo(() => {
    const set = new Set<string>()
    for (const schedule of schedules) {
      if (schedule.class_label) set.add(schedule.class_label)
    }
    for (const log of logs) {
      if (log.class_label) set.add(log.class_label)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [schedules, logs])

  const reminderByLesson = useMemo(() => {
    const map = new Map<string, TeacherReminder>()
    const active = reminders
      .filter((item) => !item.done && item.class_label && item.lesson_number)
      .sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0
        return bd - ad
      })
    for (const reminder of active) {
      const key = `${reminder.class_label}::${reminder.lesson_number}`
      if (!map.has(key)) map.set(key, reminder)
    }
    return map
  }, [reminders])

  function startRegister(schedule: TeacherSchedule) {
    setForm({
      schedule_id: schedule.id,
      class_label: schedule.class_label,
      notes: "",
      observations: "",
    })
    setRegisterSchedule(schedule)
    setRegisterOpen(true)
    setEditing(null)
    setError("")
  }

  function resetForm() {
    setForm({ schedule_id: "", class_label: "", notes: "", observations: "" })
    setError("")
  }

  function toggleClass(label: string) {
    setOpenClasses((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  function handleReminderClassChange(value: string) {
    setReminderClassLabel(value)
    if (!value) {
      setReminderLessonNumber("")
      return
    }
    const nextLesson = nextByClass.get(value) ?? 1
    setReminderLessonNumber(String(nextLesson))
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.class_label) return
    setSaving(true)
    setError("")

    const res = await fetch("/api/portal/lesson-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    const classLabel = reminderClassLabel.trim()
    const lessonRaw = reminderLessonNumber.trim()
    const lessonNumber = lessonRaw ? Number(lessonRaw) : null
    if (classLabel && !lessonRaw) {
      setReminderError(t.reminderLessonRequired)
      return
    }
    if (lessonNumber !== null && (!Number.isInteger(lessonNumber) || lessonNumber <= 0)) {
      setReminderError(t.reminderLessonInvalid)
      return
    }
    if (classLabel && lessonNumber !== null) {
      const nextLesson = nextByClass.get(classLabel) ?? 1
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
        class_label: classLabel || null,
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
    setReminderClassLabel("")
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((day) => {
                const list = schedulesByWeekday[day] ?? []
                const weekday = weekdayLabels[day] ?? day
                return (
                  <div key={day} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/80">
                      {weekday}
                    </div>
                    <div className="p-3 space-y-3">
                      {list.length === 0 && (
                        <p className="text-xs text-slate-400">{t.dayEmpty}</p>
                      )}
                      {list.map((schedule) => {
                        const nextLesson = nextByClass.get(schedule.class_label) ?? 1
                        const reminderKey = `${schedule.class_label}::${nextLesson}`
                        const reminderForLesson = reminderByLesson.get(reminderKey)
                        const reminderPreviewMax = 80
                        return (
                          <div key={schedule.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white truncate max-w-[14rem] sm:max-w-none">
                                {schedule.class_label}
                              </p>
                              <span className="text-[11px] font-semibold text-emerald-200 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                {t.lesson} {nextLesson}
                              </span>
                              <span className="text-[11px] font-semibold text-cyan-100 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                {timeLabel(schedule.start_time)} - {timeLabel(schedule.end_time)}
                              </span>
                            </div>
                            {reminderForLesson && (
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
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => startRegister(schedule)}
                              className="mt-3 bg-cyan-600 hover:bg-cyan-700 w-full"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              {registerWithNumber(nextLesson)}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
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
            {Object.keys(groupedLogs)
              .sort((a, b) => a.localeCompare(b))
              .map((classLabel) => (
              <section key={classLabel} className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleClass(classLabel)}
                    className="flex items-center gap-2 text-left"
                  >
                    <h3 className="text-sm font-semibold text-white">{classLabel}</h3>
                    <span className="text-[11px] text-white/60 border border-white/10 rounded-full px-2 py-0.5">
                      {groupedLogs[classLabel].length} {t.lessons}
                    </span>
                    {openClasses[classLabel] ? (
                      <ChevronUp className="w-4 h-4 text-white/70" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/70" />
                    )}
                  </button>
                  <span className="text-xs text-white/50">
                    {openClasses[classLabel] ? t.collapse : t.expand}
                  </span>
                </div>

                {openClasses[classLabel] && (
                <div className="space-y-3">
                  {groupedLogs[classLabel].map((log) => (
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
              setReminderClassLabel("")
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
              setReminderClassLabel("")
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
                  setReminderClassLabel("")
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
                    value={reminderClassLabel}
                    onChange={(e) => handleReminderClassChange(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  >
                    <option value="">{t.reminderGeneral}</option>
                    {classOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
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
                    disabled={!reminderClassLabel}
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
                    setReminderClassLabel("")
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
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold">{t.register}</p>
                <p className="text-xs text-white/60 truncate">{registerSchedule.class_label}</p>
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

            <form onSubmit={submitForm} className="p-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 space-y-1">
                <div>
                  {weekdayLabels[registerSchedule.weekday] ?? registerSchedule.weekday} •{" "}
                  {timeLabel(registerSchedule.start_time)} - {timeLabel(registerSchedule.end_time)}
                </div>
                <div>{getTimezoneLabel(registerSchedule.timezone)}</div>
                <div>
                  <span className="text-white/60">{t.registeringLesson}</span>
                  <span className="text-white font-semibold bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full ml-2">
                    {nextByClass.get(registerSchedule.class_label) ?? 1}
                  </span>
                </div>
                <div className="text-[11px] text-white/50">{t.autoDate}</div>
              </div>

              <div>
                <label className="text-xs text-slate-400">{t.notes}</label>
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

              {error && <p className="text-xs text-rose-300">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={saving}>
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



