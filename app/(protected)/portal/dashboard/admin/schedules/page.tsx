"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Pencil, RefreshCcw, Trash } from "lucide-react"
import type { Teacher, TeacherSchedule } from "@/app/types/portal"
import { TIMEZONE_OPTIONS, getDefaultTimezone, getTimezoneLabel } from "@/lib/timezones"

type TeacherGroupResponse = {
  approved: Teacher[]
  pending: Teacher[]
  disabled: Teacher[]
}

const weekdayOptions = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Ter\u00e7a-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
]

const weekdayLabelMap: Record<number, string> = {
  1: "Segunda-feira",
  2: "Ter\u00e7a-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "S\u00e1bado",
  7: "Domingo",
}

function weekdayLabel(value: number) {
  return weekdayLabelMap[value] ?? `Dia ${value}`
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

export default function AdminSchedulesPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("")
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    teacher_id: "",
    class_label: "",
    weekday: 1,
    start_time: "10:00",
    end_time: "10:55",
    timezone: "",
    active: true,
  })

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) ?? null,
    [teachers, selectedTeacherId]
  )

  const timezoneOptions = useMemo(() => {
    if (!selectedTeacher) return []
    return TIMEZONE_OPTIONS[selectedTeacher.country] ?? []
  }, [selectedTeacher])

  async function loadTeachers() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" })
      const data: TeacherGroupResponse = await res.json()
      const list = Array.isArray(data?.approved) ? data.approved : []
      list.sort((a, b) => a.name.localeCompare(b.name))
      setTeachers(list)
      if (!selectedTeacherId && list.length > 0) {
        setSelectedTeacherId(list[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadSchedules(teacherId: string) {
    if (!teacherId) return
    setLoadingSchedules(true)
    try {
      const res = await fetch(`/api/admin/teacher-schedules?teacherId=${teacherId}`, { cache: "no-store" })
      const data = await res.json()
      setSchedules(Array.isArray(data) ? data : [])
    } finally {
      setLoadingSchedules(false)
    }
  }

  function resetForm(forTeacher = selectedTeacher) {
    const tz = forTeacher ? getDefaultTimezone(forTeacher.country) : ""
    setForm({
      teacher_id: forTeacher?.id ?? "",
      class_label: "",
      weekday: 1,
      start_time: "10:00",
      end_time: "10:55",
      timezone: tz,
      active: true,
    })
  }

  useEffect(() => {
    loadTeachers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedTeacherId) return
    setEditingId(null)
    resetForm(selectedTeacher)
    loadSchedules(selectedTeacherId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacherId])

  function startEdit(item: TeacherSchedule) {
    setEditingId(item.id)
    setForm({
      teacher_id: item.teacher_id,
      class_label: item.class_label,
      weekday: item.weekday,
      start_time: timeLabel(item.start_time),
      end_time: timeLabel(item.end_time),
      timezone: item.timezone,
      active: item.active,
    })
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este hor\u00e1rio?")) return
    const res = await fetch(`/api/admin/teacher-schedules/${id}`, { method: "DELETE" })
    if (res.ok) loadSchedules(selectedTeacherId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.teacher_id) return

    const url = editingId
      ? `/api/admin/teacher-schedules/${editingId}`
      : "/api/admin/teacher-schedules"
    const method = editingId ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar")
      return
    }

    setEditingId(null)
    resetForm(selectedTeacher)
    loadSchedules(selectedTeacherId)
  }

  return (
    <div className="p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-300" />
            {"Horários de Aula"}
          </h1>
          <p className="text-slate-400 text-sm">{"Defina dias e hor\u00e1rios fixos para cada turma."}</p>
        </div>

        <Button
          onClick={() => loadSchedules(selectedTeacherId)}
          className="bg-white/10 hover:bg-white/15 border border-white/10"
          disabled={loadingSchedules}
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${loadingSchedules ? "animate-spin" : ""}`} />
          {"Atualizar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-6">
        <Card className="bg-slate-900/40 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">{"Professor"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-slate-400 text-sm">{"Carregando..."}</p>}
            {!loading && teachers.length === 0 && (
              <p className="text-slate-400 text-sm">{"Nenhum professor aprovado."}</p>
            )}

            {teachers.length > 0 && (
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id} className="text-white">
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {selectedTeacher && (
              <div className="text-xs text-slate-400 space-y-1">
                <div>{selectedTeacher.email}</div>
                <div>{`Pa\u00eds: ${selectedTeacher.country}`}</div>
                <div>{`Idioma: ${selectedTeacher.locale}`}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">
                {editingId ? "Editar hor\u00e1rio" : "Adicionar hor\u00e1rio"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">{"Turma / Aula"}</label>
                  <input
                    value={form.class_label}
                    onChange={(e) => setForm((prev) => ({ ...prev, class_label: e.target.value }))}
                    placeholder={"Ex: Aula para 1\u00ba Ano"}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">{"Dia da semana"}</label>
                  <select
                    value={form.weekday}
                    onChange={(e) => setForm((prev) => ({ ...prev, weekday: Number(e.target.value) }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  >
                    {weekdayOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">{"In\u00edcio"}</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">{"Fim"}</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">{"Fuso horário"}</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
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
                    checked={form.active}
                    onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <label htmlFor="schedule-active" className="text-sm text-white/80">
                    {"Ativo"}
                  </label>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                    {editingId ? "Salvar" : "Adicionar"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        resetForm(selectedTeacher)
                      }}
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                    >
                      {"Cancelar"}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">{"Hor\u00e1rios cadastrados"}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSchedules && <p className="text-slate-400">{"Carregando..."}</p>}
              {!loadingSchedules && schedules.length === 0 && (
                <p className="text-slate-400">{"Nenhum hor\u00e1rio cadastrado."}</p>
              )}

              <div className="space-y-3">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{s.class_label}</div>
                      <div className="text-xs text-white/70">
                        {weekdayLabel(s.weekday)}{" \u2022 "}
                        {timeLabel(s.start_time)} - {timeLabel(s.end_time)}
                      </div>
                      <div className="text-xs text-white/50">{getTimezoneLabel(s.timezone)}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full border ${
                          s.active
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {"Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        {"Excluir"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
