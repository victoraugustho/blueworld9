"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Teacher, TeacherLessonLog, TeacherSchedule } from "@/app/types/portal"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Ban,
  Trash,
  Video,
} from "lucide-react"
import { TIMEZONE_OPTIONS, getDefaultTimezone, getTimezoneLabel } from "@/lib/timezones"

type Country = Teacher["country"]

type AuditLog = {
  id: string
  action: string
  status?: string | null
  request_path?: string | null
  created_at: string
}

type VideoSummary = {
  total_videos: number
  started_videos: number
  watched_videos: number
  avg_progress: number
}

type VideoProgress = {
  id: string
  title: string
  progress_percent: number
  updated_at?: string | null
}

type LessonSummary = {
  total_logs: number
  class_count: number
  last_lesson_date?: string | null
}

type LessonClass = {
  class_label: string
  last_lesson: number
  last_date?: string | null
  next_lesson: number
}

type TeacherInsights = {
  logs: AuditLog[]
  videoSummary: VideoSummary
  recentProgress: VideoProgress[]
  lessonSummary: LessonSummary
  lessonClasses: LessonClass[]
}

const scheduleDays = [1, 2, 3, 4, 5]
const weekdayLabelMap: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  7: "Domingo",
}

function weekdayLabel(value: number) {
  return weekdayLabelMap[value] ?? `Dia ${value}`
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function countryLabel(c: Country) {
  if (c === "BR") return "Brasil"
  if (c === "UY") return "Uruguai"
  return "Paraguai"
}

function docLabel(t: Teacher) {
  if (t.document_type === "CPF") return "CPF"
  return "CI"
}

function localeBadge(locale: Teacher["locale"]) {
  return locale === "pt-BR"
    ? { label: "PT", cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" }
    : { label: "ES", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/20" }
}

function statusBadge(teacher: Teacher) {
  if (!teacher.approved) {
    return { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20" }
  }
  if (teacher.active === false) {
    return { label: "Desativado", cls: "bg-red-500/15 text-red-300 border border-red-500/20" }
  }
  return { label: "Aprovado", cls: "bg-green-500/15 text-green-300 border border-green-500/20" }
}

function formatDate(dt?: any) {
  if (!dt) return "-"
  if (typeof dt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dt)) {
    const d = new Date(`${dt}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    }
  }
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return String(dt)
  return d.toLocaleString("pt-BR")
}

function maskPhone(phone?: string) {
  const p = String(phone ?? "").replace(/\D/g, "")
  if (p.length < 10) return phone ?? "-"
  const ddd = p.slice(0, 2)
  const mid = p.length === 11 ? p.slice(2, 7) : p.slice(2, 6)
  const end = p.length === 11 ? p.slice(7) : p.slice(6)
  return `(${ddd}) ${mid}-${end}`
}

export default function TeacherInfoClient({ teacherId }: { teacherId: string }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [logs, setLogs] = useState<TeacherLessonLog[]>([])
  const [insights, setInsights] = useState<TeacherInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({})
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [scheduleForm, setScheduleForm] = useState({
    teacher_id: "",
    class_label: "",
    weekday: 1,
    start_time: "10:00",
    end_time: "10:55",
    timezone: "",
    active: true,
  })

  const schedulesByWeekday = useMemo(() => {
    const map: Record<number, TeacherSchedule[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    for (const schedule of schedules) {
      if (map[schedule.weekday]) map[schedule.weekday].push(schedule)
    }
    for (const day of scheduleDays) {
      map[day].sort((a, b) => timeLabel(a.start_time).localeCompare(timeLabel(b.start_time)))
    }
    return map
  }, [schedules])

  const timezoneOptions = useMemo(() => {
    if (!teacher) return []
    return TIMEZONE_OPTIONS[teacher.country] ?? []
  }, [teacher])

  const groupedLogs = useMemo(() => {
    const groups: Record<string, TeacherLessonLog[]> = {}
    for (const log of logs) {
      const key = log.class_label || "Sem turma"
      if (!groups[key]) groups[key] = []
      groups[key].push(log)
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const dateA = String(a.lesson_date ?? "")
        const dateB = String(b.lesson_date ?? "")
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        return (b.lesson_number ?? 0) - (a.lesson_number ?? 0)
      })
    }
    return groups
  }, [logs])

  useEffect(() => {
    if (Object.keys(openClasses).length > 0) return
    const keys = Object.keys(groupedLogs)
    if (keys.length === 0) return
    // Mantém tudo fechado por padrão.
    setOpenClasses(Object.fromEntries(keys.map((key) => [key, false])))
  }, [groupedLogs, openClasses])

  async function loadAll() {
    if (!teacherId) return
    setLoading(true)
    setError("")
    try {
      const [tRes, sRes, iRes, lRes] = await Promise.all([
        fetch(`/api/admin/teachers/${teacherId}`, { cache: "no-store" }),
        fetch(`/api/admin/teacher-schedules?teacherId=${teacherId}`, { cache: "no-store" }),
        fetch(`/api/admin/teachers/${teacherId}/insights`, { cache: "no-store" }),
        fetch(`/api/admin/teacher-lesson-logs?teacherId=${teacherId}`, { cache: "no-store" }),
      ])

      if (!tRes.ok) {
        setTeacher(null)
        setSchedules([])
        setInsights(null)
        setLogs([])
        setError("Professor não encontrado.")
        return
      }

      const teacherData = await tRes.json()
      const schedulesData = await sRes.json()
      const insightsData = await iRes.json()
      const logsData = await lRes.json()

      setTeacher(teacherData ?? null)
      setSchedules(Array.isArray(schedulesData) ? schedulesData : [])
      setInsights(insightsData ?? null)
      setLogs(Array.isArray(logsData) ? logsData : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  useEffect(() => {
    if (!teacher) return
    resetScheduleForm(teacher)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher?.id])

  async function refresh() {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  async function loadSchedulesOnly() {
    if (!teacherId) return
    const res = await fetch(`/api/admin/teacher-schedules?teacherId=${teacherId}`, { cache: "no-store" })
    const data = await res.json()
    setSchedules(Array.isArray(data) ? data : [])
  }

  async function loadLogsOnly() {
    if (!teacherId) return
    const res = await fetch(`/api/admin/teacher-lesson-logs?teacherId=${teacherId}`, { cache: "no-store" })
    const data = await res.json()
    setLogs(Array.isArray(data) ? data : [])
  }

  function resetScheduleForm(forTeacher = teacher) {
    const tz = forTeacher ? getDefaultTimezone(forTeacher.country) : ""
    setScheduleForm({
      teacher_id: forTeacher?.id ?? "",
      class_label: "",
      weekday: 1,
      start_time: "10:00",
      end_time: "10:55",
      timezone: tz,
      active: true,
    })
    setEditingScheduleId(null)
    setScheduleError("")
  }

  function startEditSchedule(item: TeacherSchedule) {
    setEditingScheduleId(item.id)
    setScheduleForm({
      teacher_id: item.teacher_id,
      class_label: item.class_label,
      weekday: item.weekday,
      start_time: timeLabel(item.start_time),
      end_time: timeLabel(item.end_time),
      timezone: item.timezone,
      active: item.active,
    })
    setScheduleError("")
  }

  async function submitSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!teacher) return
    setScheduleSaving(true)
    setScheduleError("")

    const url = editingScheduleId
      ? `/api/admin/teacher-schedules/${editingScheduleId}`
      : "/api/admin/teacher-schedules"
    const method = editingScheduleId ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scheduleForm, teacher_id: teacher.id }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error ?? "Erro ao salvar")
      setScheduleSaving(false)
      return
    }

    resetScheduleForm(teacher)
    await loadSchedulesOnly()
    setScheduleSaving(false)
  }

  async function deleteSchedule(id: string) {
    if (!confirm("Deseja excluir este horário?")) return
    const res = await fetch(`/api/admin/teacher-schedules/${id}`, { method: "DELETE" })
    if (res.ok) {
      await loadSchedulesOnly()
    }
  }

  async function deleteLog(id: string) {
    if (!confirm("Deseja excluir este registro do diário?")) return
    const res = await fetch(`/api/admin/teacher-lesson-logs/${id}`, { method: "DELETE" })
    if (res.ok) {
      await loadLogsOnly()
    }
  }

  async function approve() {
    if (!teacher) return
    await fetch(`/api/admin/teachers/${teacher.id}/approve`, { method: "PATCH" })
    refresh()
  }

  async function disable() {
    if (!teacher) return
    await fetch(`/api/admin/teachers/${teacher.id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    refresh()
  }

  async function enable() {
    if (!teacher) return
    await fetch(`/api/admin/teachers/${teacher.id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    refresh()
  }

  function toggleClass(label: string) {
    setOpenClasses((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 text-white space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/portal/dashboard/admin/teachers"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {teacher ? teacher.name : "Detalhes do professor"}
            </h1>
            {teacher && <p className="text-slate-400 text-sm">{teacher.email}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={refresh}
            className="bg-white/10 hover:bg-white/15 border border-white/10"
            disabled={refreshing || loading}
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {teacher && (
            <Link href={`/portal/dashboard/admin/teachers/${teacher.id}`}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
          )}
          {teacher && !teacher.approved && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={approve}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aprovar
            </Button>
          )}
          {teacher && teacher.approved && teacher.active !== false && (
            <Button className="bg-red-600 hover:bg-red-700" onClick={disable}>
              <Ban className="w-4 h-4 mr-2" />
              Desativar
            </Button>
          )}
          {teacher && teacher.approved && teacher.active === false && (
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={enable}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reativar
            </Button>
          )}
        </div>
      </div>

      {loading && <p className="text-slate-400">Carregando...</p>}
      {!loading && error && <p className="text-rose-300">{error}</p>}

      {!loading && teacher && (
        <>
          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Dados do professor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`text-xs rounded-full px-3 py-1 ${localeBadge(teacher.locale).cls}`}>
                  {localeBadge(teacher.locale).label}
                </span>
                <span className={`text-xs rounded-full px-3 py-1 ${statusBadge(teacher).cls}`}>
                  {statusBadge(teacher).label}
                </span>
                <span className="text-xs text-white/70 bg-white/10 border border-white/10 rounded-full px-3 py-1">
                  {countryLabel(teacher.country)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Nome</p>
                  <p className="text-white mt-1">{teacher.name}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Telefone</p>
                  <p className="text-white mt-1">{maskPhone(teacher.phone)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Documento</p>
                  <p className="text-white mt-1">
                    {docLabel(teacher)}: {teacher.document_number}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Locale</p>
                  <p className="text-white mt-1">{teacher.locale}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">País</p>
                  <p className="text-white mt-1">{teacher.country}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Criado em</p>
                  <p className="text-white mt-1">{formatDate((teacher as any).created_at)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Atualizado em</p>
                  <p className="text-white mt-1">{formatDate((teacher as any).updated_at)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-white/60 text-xs">ID</p>
                  <p className="text-white mt-1 font-mono text-xs break-all">{teacher.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-cyan-300" />
                Agenda (horários fixos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">Turma / Aula</label>
                  <input
                    value={scheduleForm.class_label}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, class_label: e.target.value }))}
                    placeholder="Ex: Aula para 1º Ano"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Dia da semana</label>
                  <select
                    value={scheduleForm.weekday}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, weekday: Number(e.target.value) }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  >
                    {scheduleDays.map((day) => (
                      <option key={day} value={day} className="text-white">
                        {weekdayLabel(day)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Início</label>
                  <input
                    type="time"
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Fim</label>
                  <input
                    type="time"
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Fuso horário</label>
                  <select
                    value={scheduleForm.timezone}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  >
                    {timezoneOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-6 md:mt-7">
                  <input
                    id="schedule-active"
                    type="checkbox"
                    checked={scheduleForm.active}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <label htmlFor="schedule-active" className="text-sm text-white/80">
                    Ativo
                  </label>
                </div>

                {scheduleError && (
                  <p className="text-xs text-rose-300 md:col-span-2">{scheduleError}</p>
                )}

                <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={scheduleSaving}>
                    {editingScheduleId ? "Salvar" : "Adicionar"}
                  </Button>
                  {editingScheduleId && (
                    <Button
                      type="button"
                      onClick={() => resetScheduleForm(teacher)}
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>

              {schedules.length === 0 && <p className="text-slate-400">Nenhum horário cadastrado.</p>}
              {schedules.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  {scheduleDays.map((day) => {
                    const list = schedulesByWeekday[day] ?? []
                    return (
                      <div key={day} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                        <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/80">
                          {weekdayLabel(day)}
                        </div>
                        <div className="p-3 space-y-3">
                          {list.length === 0 && (
                            <p className="text-xs text-slate-400">Sem horários</p>
                          )}
                          {list.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-white truncate max-w-[14rem] sm:max-w-none">
                                  {schedule.class_label}
                                </p>
                                <span className="text-[11px] font-semibold text-cyan-100 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                  {timeLabel(schedule.start_time)} - {timeLabel(schedule.end_time)}
                                </span>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                    schedule.active
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                  }`}
                                >
                                  {schedule.active ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                              <div className="text-xs text-white/50">
                                {getTimezoneLabel(schedule.timezone)}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditSchedule(schedule)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-200"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSchedule(schedule.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                  Excluir
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-300" />
                Diário do professor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {logs.length === 0 && <p className="text-slate-400">Nenhum registro encontrado.</p>}

              {Object.keys(groupedLogs).map((label) => {
                const list = groupedLogs[label] ?? []
                const isOpen = openClasses[label] !== false
                return (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleClass(label)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{label}</p>
                        <p className="text-xs text-white/60">{list.length} registros</p>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-white/70" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/70" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/10 divide-y divide-white/10">
                        {list.map((log) => (
                          <div key={log.id} className="px-4 py-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-white/80 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">
                                  Aula {log.lesson_number}
                                </span>
                                <span className="text-xs text-white/60">
                                  {formatDate(log.lesson_date)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteLog(log.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200"
                              >
                                <Trash className="w-3.5 h-3.5" />
                                Excluir
                              </button>
                            </div>
                            {log.notes && (
                              <div>
                                <p className="text-[11px] text-white/50">Notas</p>
                                <p className="text-sm text-white/80 whitespace-pre-wrap">{log.notes}</p>
                              </div>
                            )}
                            {log.observations && (
                              <div>
                                <p className="text-[11px] text-white/50">Observações</p>
                                <p className="text-sm text-white/70 whitespace-pre-wrap">
                                  {log.observations}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-300" />
                Atividade em vídeos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!insights && <p className="text-slate-400">Carregando informações...</p>}
              {insights && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-white/60 text-xs">Total de aulas</p>
                      <p className="text-white mt-1 text-lg font-semibold">
                        {insights.videoSummary?.total_videos ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-white/60 text-xs">Iniciadas</p>
                      <p className="text-white mt-1 text-lg font-semibold">
                        {insights.videoSummary?.started_videos ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-white/60 text-xs">Assistidas (&gt;=70%)</p>
                      <p className="text-white mt-1 text-lg font-semibold">
                        {insights.videoSummary?.watched_videos ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-white/60 text-xs">Média de progresso</p>
                      <p className="text-white mt-1 text-lg font-semibold">
                        {Number(insights.videoSummary?.avg_progress ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white mb-3">Progresso recente</h4>
                    {insights.recentProgress?.length ? (
                      <div className="space-y-3">
                        {insights.recentProgress.map((item) => {
                          const pct = Math.max(0, Math.min(100, Number(item.progress_percent ?? 0)))
                          return (
                            <div key={item.id} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-white truncate">{item.title}</p>
                                  <p className="text-xs text-slate-400">{formatDate(item.updated_at)}</p>
                                </div>
                                <span className="text-xs text-white/80">{Math.round(pct)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">Nenhum progresso registrado.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-cyan-300" />
                Resumo do diário e logs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!insights && <p className="text-slate-400">Carregando informações...</p>}
              {insights && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-white/60">Registros totais</p>
                      <p className="text-white mt-1 text-base font-semibold">
                        {insights.lessonSummary?.total_logs ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-white/60">Turmas com aulas</p>
                      <p className="text-white mt-1 text-base font-semibold">
                        {insights.lessonSummary?.class_count ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-white/60">Última aula registrada</p>
                      <p className="text-white mt-1 text-base font-semibold">
                        {formatDate(insights.lessonSummary?.last_lesson_date)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {insights.lessonClasses?.length ? (
                      insights.lessonClasses.map((item) => (
                        <div
                          key={item.class_label}
                          className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{item.class_label}</p>
                            {item.last_lesson > 0 ? (
                              <p className="text-xs text-white/60">
                                Aula atual: {item.last_lesson} • Última: {formatDate(item.last_date)}
                              </p>
                            ) : (
                              <p className="text-xs text-white/60">Sem registros ainda.</p>
                            )}
                          </div>
                          <span className="text-[11px] text-white/80 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-full">
                            Próxima: {item.next_lesson}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">Nenhum diário registrado.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-sm font-semibold text-white mb-3">Logs recentes</h4>
                    {insights.logs?.length ? (
                      <div className="space-y-2">
                        {insights.logs.map((log) => (
                          <div key={log.id} className="flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="text-white truncate">{log.action}</p>
                              <p className="text-slate-400 truncate">
                                {formatDate(log.created_at)}{" "}
                                {log.request_path ? `- ${log.request_path}` : ""}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 border ${
                                log.status === "failed"
                                  ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                              }`}
                            >
                              {log.status ?? "success"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">Nenhum log recente.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
