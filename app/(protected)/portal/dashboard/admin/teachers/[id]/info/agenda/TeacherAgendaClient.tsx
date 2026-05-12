"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock3, Pencil, RefreshCcw, Save, Search, Trash2, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Teacher, TeacherClass, TeacherSchedule } from "@/app/types/portal"

const weekdayLabel: Record<number, string> = {
  1: "Segunda",
  2: "Terca",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sabado",
  7: "Domingo",
}

type ScheduleForm = {
  class_id: string
  class_label: string
  entry_type: "class" | "event"
  is_recurring: boolean
  event_date: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
  active: boolean
}

function timeLabel(value: string) {
  return String(value ?? "").slice(0, 5)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const normalized = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""
  if (!normalized) return String(value)
  const date = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

function shortClassId(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return raw.slice(0, 8)
}

function normalizeDateInput(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  return raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""
}

function toComparableNumber(value: string) {
  return Number(String(value).replaceAll("-", "")) || 0
}

function sortSchedules(items: TeacherSchedule[]) {
  return [...items].sort((a, b) => {
    if (a.is_recurring === false && b.is_recurring !== false) return 1
    if (a.is_recurring !== false && b.is_recurring === false) return -1

    if (a.is_recurring === false && b.is_recurring === false) {
      const dateA = toComparableNumber(normalizeDateInput(a.event_date))
      const dateB = toComparableNumber(normalizeDateInput(b.event_date))
      if (dateA !== dateB) return dateA - dateB
    } else {
      const dayA = Number(a.weekday ?? 0)
      const dayB = Number(b.weekday ?? 0)
      if (dayA !== dayB) return dayA - dayB
    }

    const timeA = timeLabel(a.start_time)
    const timeB = timeLabel(b.start_time)
    if (timeA !== timeB) return timeA.localeCompare(timeB)
    return String(a.class_label ?? "").localeCompare(String(b.class_label ?? ""), "pt-BR")
  })
}

function makeForm(item: TeacherSchedule): ScheduleForm {
  return {
    class_id: String(item.class_id ?? ""),
    class_label: String(item.class_label ?? ""),
    entry_type: item.entry_type === "event" ? "event" : "class",
    is_recurring: item.is_recurring !== false,
    event_date: normalizeDateInput(item.event_date),
    weekday: Number(item.weekday ?? 1),
    start_time: timeLabel(item.start_time) || "10:00",
    end_time: timeLabel(item.end_time) || "10:55",
    timezone: String(item.timezone ?? ""),
    active: item.active === true,
  }
}

export default function TeacherAgendaClient({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([])
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState("")
  const [form, setForm] = useState<ScheduleForm | null>(null)
  const [error, setError] = useState("")

  async function loadAll() {
    setLoading(true)
    setError("")
    try {
      const [teacherRes, scheduleRes, classesRes] = await Promise.all([
        fetch(`/api/admin/teachers/${teacherId}`, { cache: "no-store" }),
        fetch(`/api/admin/teacher-schedules?teacherId=${teacherId}`, { cache: "no-store" }),
        fetch(`/api/portal/gradebook/classes?teacherId=${teacherId}&allYears=1`, { cache: "no-store" }),
      ])

      const teacherData = await teacherRes.json().catch(() => null)
      const scheduleData = await scheduleRes.json().catch(() => [])
      const classesData = await classesRes.json().catch(() => [])

      setTeacher(teacherData?.id ? teacherData : null)
      setSchedules(Array.isArray(scheduleData) ? sortSchedules(scheduleData) : [])
      setTeacherClasses(Array.isArray(classesData) ? classesData : [])
    } catch {
      setError("Nao foi possivel carregar agenda.")
      setSchedules([])
      setTeacherClasses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return schedules
    return schedules.filter((item) => {
      const label = String(item.class_label ?? "").toLowerCase()
      const type = item.entry_type === "event" ? "evento" : "turma"
      const id = String(item.class_id ?? "").toLowerCase()
      const date = formatDate(item.event_date).toLowerCase()
      const day = String(weekdayLabel[item.weekday] ?? "").toLowerCase()
      const start = timeLabel(item.start_time)
      const end = timeLabel(item.end_time)
      return (
        label.includes(query) ||
        type.includes(query) ||
        id.includes(query) ||
        date.includes(query) ||
        day.includes(query) ||
        start.includes(query) ||
        end.includes(query)
      )
    })
  }, [schedules, search])

  function startEdit(item: TeacherSchedule) {
    setError("")
    setEditingId(item.id)
    setForm(makeForm(item))
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(null)
    setError("")
  }

  async function saveEdit() {
    if (!editingId || !form) return
    setSaving(true)
    setError("")

    const payload: Record<string, unknown> = {
      entry_type: form.entry_type,
      is_recurring: form.entry_type === "class" ? true : form.is_recurring,
      event_date: form.entry_type === "event" && form.is_recurring === false ? form.event_date : "",
      weekday: form.weekday,
      start_time: form.start_time,
      end_time: form.end_time,
      timezone: form.timezone,
      active: form.active,
    }

    if (form.entry_type === "class") {
      if (!form.class_id) {
        setSaving(false)
        setError("Selecione a turma para salvar.")
        return
      }
      payload.class_id = form.class_id
      payload.class_label = ""
    } else {
      if (!form.class_label.trim()) {
        setSaving(false)
        setError("Informe o titulo do evento.")
        return
      }
      payload.class_id = null
      payload.class_label = form.class_label.trim()
    }

    const res = await fetch(`/api/admin/teacher-schedules/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)

    setSaving(false)
    if (!res.ok) {
      setError(String(data?.error ?? "Nao foi possivel salvar alteracoes."))
      return
    }

    cancelEdit()
    await loadAll()
  }

  async function deleteItem(item: TeacherSchedule) {
    if (!confirm("Deseja excluir este item da agenda?")) return

    setDeletingId(item.id)
    setError("")
    const res = await fetch(`/api/admin/teacher-schedules/${item.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => null)
    setDeletingId("")

    if (!res.ok) {
      setError(String(data?.error ?? "Nao foi possivel excluir item."))
      return
    }

    if (editingId === item.id) {
      cancelEdit()
    }
    await loadAll()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda do professor</h1>
          <p className="text-sm text-slate-300">
            {teacher ? `${teacher.name} | ${teacher.email}` : "Visualizacao, edicao e organizacao da agenda"}
          </p>
        </div>
        <Button onClick={() => void loadAll()} className="bg-white/10 hover:bg-white/15 border border-white/10" disabled={loading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-slate-900/30 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-300" />
            Filtro da agenda
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por turma, tipo, data, dia, horario ou ID"
            className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
          />
          <Button
            type="button"
            onClick={() => setSearch("")}
            disabled={!search.trim()}
            className="bg-white/10 hover:bg-white/15 border border-white/10"
          >
            Limpar busca
          </Button>
        </CardContent>
      </Card>

      {editingId && form ? (
        <Card className="bg-slate-900/30 backdrop-blur-sm border border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-cyan-300" />
              Editar item da agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) =>
                    prev
                      ? { ...prev, entry_type: "class", is_recurring: true, event_date: "", class_label: "" }
                      : prev,
                  )
                }
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  form.entry_type === "class"
                    ? "bg-cyan-600 border-cyan-500 text-white"
                    : "bg-white/5 border-white/15 text-white/80"
                }`}
              >
                Turma
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) =>
                    prev ? { ...prev, entry_type: "event", class_id: "" } : prev,
                  )
                }
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  form.entry_type === "event"
                    ? "bg-cyan-600 border-cyan-500 text-white"
                    : "bg-white/5 border-white/15 text-white/80"
                }`}
              >
                Evento
              </button>
            </div>

            {form.entry_type === "class" ? (
              <div>
                <label className="text-xs text-slate-300">Turma</label>
                <select
                  value={form.class_id}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, class_id: event.target.value } : prev))}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                >
                  <option value="">Selecione uma turma</option>
                  {teacherClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} | {item.school_year} | ID {shortClassId(item.id)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-300">Titulo do evento</label>
                <input
                  value={form.class_label}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, class_label: event.target.value } : prev))
                  }
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                  placeholder="Ex: Reuniao pedagogica"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {form.entry_type === "event" ? (
                <label className="text-xs text-slate-300 flex items-center gap-2 sm:col-span-2 md:col-span-1 mt-6">
                  <input
                    type="checkbox"
                    checked={form.is_recurring}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              is_recurring: event.target.checked,
                              event_date: event.target.checked ? "" : prev.event_date,
                            }
                          : prev,
                      )
                    }
                    className="rounded border-white/20"
                  />
                  Recorrente
                </label>
              ) : null}

              {form.entry_type === "class" || form.is_recurring ? (
                <div>
                  <label className="text-xs text-slate-300">Dia da semana</label>
                  <select
                    value={form.weekday}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, weekday: Number(event.target.value) } : prev))}
                    className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                  >
                    {Object.entries(weekdayLabel).map(([value, label]) => (
                      <option key={value} value={Number(value)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-300">Data do evento</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, event_date: event.target.value } : prev))}
                    className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-300">Inicio</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, start_time: event.target.value } : prev))}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300">Fim</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, end_time: event.target.value } : prev))}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300">Fuso horario</label>
                <input
                  value={form.timezone}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, timezone: event.target.value } : prev))}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-white"
                />
              </div>
            </div>

            <label className="text-xs text-slate-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, active: event.target.checked } : prev))}
                className="rounded border-white/20"
              />
              Item ativo
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </Button>
              <Button type="button" onClick={cancelEdit} className="bg-white/10 hover:bg-white/15 border border-white/10">
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-slate-900/30 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-cyan-300" />
            Lista da agenda ({filteredSchedules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-rose-300 mb-3">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-slate-400">Carregando agenda...</p>
          ) : filteredSchedules.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum item encontrado.</p>
          ) : (
            <div className="space-y-2">
              {filteredSchedules.map((item) => {
                const isEvent = item.entry_type === "event"
                const isOneOff = item.is_recurring === false
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{item.class_label}</p>
                        <span className="text-[11px] rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-white/85">
                          {isEvent ? "Evento" : "Turma"}
                        </span>
                        {item.class_id ? (
                          <span className="text-[11px] rounded-full border border-cyan-500/35 bg-cyan-500/15 px-2 py-0.5 text-cyan-100">
                            ID turma: {shortClassId(item.class_id)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {isOneOff ? `${formatDate(item.event_date)} | ` : `${weekdayLabel[item.weekday] ?? "-"} | `}
                        {timeLabel(item.start_time)} - {timeLabel(item.end_time)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.timezone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="h-8 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 text-blue-100"
                      >
                        <Pencil className="w-4 h-4 mr-1.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void deleteItem(item)}
                        disabled={deletingId === item.id}
                        className="h-8 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-100"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        {deletingId === item.id ? "Excluindo..." : "Excluir"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/30 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-cyan-300" />
            Resumo
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300">
          Itens recorrentes: {schedules.filter((item) => item.is_recurring !== false).length} | Eventos pontuais:{" "}
          {schedules.filter((item) => item.is_recurring === false).length}
        </CardContent>
      </Card>
    </div>
  )
}
