"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Pencil,
  RefreshCcw,
  Trash,
} from "lucide-react"
import { TIMEZONE_OPTIONS, getTimezoneLabel } from "@/lib/timezones"

type Locale = "pt-BR" | "es"

type CoordinationAgendaItem = {
  id: string
  title: string
  weekday: number
  start_time: string
  end_time: string
  timezone: string
  active: boolean
  created_at?: string
  updated_at?: string
}

type CoordinationAgendaEvent = {
  id: string
  title: string
  event_date: string
  start_time: string
  end_time: string
  timezone: string
  active: boolean
  created_at?: string
  updated_at?: string
}

type TaskStatus = "todo" | "doing" | "done"
type TaskPriority = "low" | "medium" | "high"

type CoordinationTask = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  created_at?: string
  updated_at?: string
}

function timeLabel(value: string) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function weekdayLabel(value: number, locale: Locale) {
  const labels =
    locale === "es"
      ? ["", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
      : ["", "Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado", "Domingo"]
  return labels[value] ?? `Dia ${value}`
}

function uniqueTimezoneOptions() {
  const map = new Map<string, { value: string; label: string }>()
  for (const options of Object.values(TIMEZONE_OPTIONS)) {
    for (const opt of options) {
      if (!map.has(opt.value)) map.set(opt.value, opt)
    }
  }
  return Array.from(map.values())
}

function startOfWeekMonday(value: Date) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  const dayIndex = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayIndex)
  return d
}

function addDays(value: Date, days: number) {
  const d = new Date(value)
  d.setDate(d.getDate() + days)
  return d
}

function formatDayDate(value: Date, locale: Locale) {
  return value.toLocaleDateString(locale === "es" ? "es-ES" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })
}

function formatWeekRange(start: Date, end: Date, locale: Locale) {
  const lang = locale === "es" ? "es-ES" : "pt-BR"
  const startLabel = start.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" })
  const endLabel = end.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" })
  return `${startLabel} - ${endLabel}`
}

function normalizeDateInput(value: unknown) {
  if (!value) return ""
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/)
    if (match) return match[0]
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return ""
}

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "-"
  try {
    const d = new Date(`${normalizeDateInput(value)}T00:00:00`)
    return d.toLocaleDateString(locale === "es" ? "es-ES" : "pt-BR")
  } catch {
    return String(value)
  }
}

function defaultEventDate() {
  return normalizeDateInput(addDays(startOfWeekMonday(new Date()), 1))
}

function taskPriorityRank(priority: TaskPriority) {
  if (priority === "high") return 1
  if (priority === "medium") return 2
  return 3
}

export default function AdminAgendaClient({ locale }: { locale: Locale }) {
  const t =
    locale === "es"
      ? {
          title: "Panel de Coordinacion",
          subtitle: "Agenda compartida y tablero de tareas para coordinadores.",
          tabAgenda: "Agenda",
          tabTasks: "Tareas",
          refresh: "Actualizar",
          loading: "Cargando...",
          weekTitle: "Agenda semanal de coordinacion",
          weekCurrent: "Semana actual",
          weekFuture: "Semana",
          weekBack: "Semana anterior",
          weekForward: "Proxima semana",
          formAdd: "Agregar compromiso",
          formEdit: "Editar compromiso",
          repeatModeLabel: "Repeticion",
          repeatWeekly: "Se repite semanalmente",
          noRepeat: "No se repite",
          weekdays: "Dias de la semana",
          weekdaysRequired: "Seleccione al menos un dia.",
          editModeLocked: "Para cambiar el tipo de repeticion, primero cancele la edicion.",
          commitment: "Compromiso",
          commitmentPlaceholder: "Ej: Reunion de planificacion",
          eventDate: "Fecha",
          eventDateRequired: "Fecha obligatoria.",
          weekday: "Dia de la semana",
          start: "Inicio",
          end: "Fin",
          timezone: "Zona horaria",
          active: "Activo",
          save: "Guardar",
          add: "Agregar",
          cancel: "Cancelar",
          noSchedules: "No hay compromisos cargados en esta semana.",
          dayEmpty: "Sin compromisos",
          edit: "Editar",
          remove: "Eliminar",
          removeConfirm: "Desea eliminar este compromiso?",
          eventRemoveConfirm: "Desea eliminar este compromiso variable?",
          commitmentRequired: "Ingrese el compromiso.",
          genericError: "No fue posible guardar.",
          loadError: "No fue posible cargar la agenda.",
          statusActive: "Activo",
          statusInactive: "Inactivo",
          badgeFixed: "Fijo",
          badgeVariable: "Variable",
          tasksTitle: "Tablero de tareas",
          taskAdd: "Agregar tarea",
          taskEdit: "Editar tarea",
          taskTitle: "Titulo",
          taskDesc: "Descripcion",
          taskDescPlaceholder: "Detalle corto de la tarea",
          taskStatus: "Estado",
          taskPriority: "Prioridad",
          taskDue: "Fecha limite",
          taskNoCards: "Sin tareas en esta columna.",
          taskDeleteConfirm: "Desea eliminar esta tarea?",
          taskTitleRequired: "Titulo obligatorio.",
          priorityLow: "Baja",
          priorityMedium: "Media",
          priorityHigh: "Alta",
          colTodo: "Por hacer",
          colDoing: "En progreso",
          colDone: "Hecho",
        }
      : {
          title: "Painel da Coordenacao",
          subtitle: "Agenda compartilhada e quadro de tarefas para coordenadores.",
          tabAgenda: "Agenda",
          tabTasks: "Tarefas",
          refresh: "Atualizar",
          loading: "Carregando...",
          weekTitle: "Agenda semanal da coordenacao",
          weekCurrent: "Semana atual",
          weekFuture: "Semana",
          weekBack: "Semana anterior",
          weekForward: "Proxima semana",
          formAdd: "Adicionar compromisso",
          formEdit: "Editar compromisso",
          repeatModeLabel: "Repeticao",
          repeatWeekly: "Repete semanalmente",
          noRepeat: "Nao repete",
          weekdays: "Dias da semana",
          weekdaysRequired: "Selecione pelo menos um dia.",
          editModeLocked: "Para mudar o tipo de repeticao, cancele a edicao primeiro.",
          commitment: "Compromisso",
          commitmentPlaceholder: "Ex: Reuniao de planejamento",
          eventDate: "Data",
          eventDateRequired: "Data obrigatoria.",
          weekday: "Dia da semana",
          start: "Inicio",
          end: "Fim",
          timezone: "Fuso horario",
          active: "Ativo",
          save: "Salvar",
          add: "Adicionar",
          cancel: "Cancelar",
          noSchedules: "Nenhum compromisso cadastrado nesta semana.",
          dayEmpty: "Sem compromissos",
          edit: "Editar",
          remove: "Excluir",
          removeConfirm: "Deseja excluir este compromisso?",
          eventRemoveConfirm: "Deseja excluir este compromisso variavel?",
          commitmentRequired: "Informe o compromisso.",
          genericError: "Nao foi possivel salvar.",
          loadError: "Nao foi possivel carregar a agenda.",
          statusActive: "Ativo",
          statusInactive: "Inativo",
          badgeFixed: "Fixo",
          badgeVariable: "Variavel",
          tasksTitle: "Quadro de tarefas",
          taskAdd: "Adicionar tarefa",
          taskEdit: "Editar tarefa",
          taskTitle: "Titulo",
          taskDesc: "Descricao",
          taskDescPlaceholder: "Detalhe curto da tarefa",
          taskStatus: "Status",
          taskPriority: "Prioridade",
          taskDue: "Data limite",
          taskNoCards: "Sem tarefas nesta coluna.",
          taskDeleteConfirm: "Deseja excluir esta tarefa?",
          taskTitleRequired: "Titulo obrigatorio.",
          priorityLow: "Baixa",
          priorityMedium: "Media",
          priorityHigh: "Alta",
          colTodo: "A fazer",
          colDoing: "Em andamento",
          colDone: "Concluido",
        }

  const timezoneOptions = useMemo(() => uniqueTimezoneOptions(), [])
  const defaultTimezone = timezoneOptions[0]?.value ?? "America/Sao_Paulo"
  const [tab, setTab] = useState<"agenda" | "tasks">("agenda")

  const [items, setItems] = useState<CoordinationAgendaItem[]>([])
  const [events, setEvents] = useState<CoordinationAgendaEvent[]>([])
  const [loadingAgenda, setLoadingAgenda] = useState(true)
  const [savingAgenda, setSavingAgenda] = useState(false)
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [agendaError, setAgendaError] = useState("")
  const [weekOffset, setWeekOffset] = useState(0)

  const [agendaForm, setAgendaForm] = useState({
    title: "",
    repeatWeekly: true,
    weekdays: [1],
    event_date: defaultEventDate(),
    start_time: "09:00",
    end_time: "10:00",
    timezone: defaultTimezone,
    active: true,
  })

  const [tasks, setTasks] = useState<CoordinationTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [savingTask, setSavingTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskError, setTaskError] = useState("")

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    due_date: "",
  })

  const scheduleDays = [1, 2, 3, 4, 5]
  const taskColumns: TaskStatus[] = ["todo", "doing", "done"]

  const weekStart = useMemo(() => {
    const today = new Date()
    const monday = startOfWeekMonday(today)
    return addDays(monday, weekOffset * 7)
  }, [weekOffset])

  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart])

  const weekDates = useMemo(() => {
    const map: Record<number, Date> = { 1: weekStart, 2: weekStart, 3: weekStart, 4: weekStart, 5: weekStart }
    for (const day of scheduleDays) {
      map[day] = addDays(weekStart, day - 1)
    }
    return map
  }, [weekStart])

  const agendaByWeekday = useMemo(() => {
    const map: Record<number, CoordinationAgendaItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    for (const item of items) {
      if (map[item.weekday]) map[item.weekday].push(item)
    }
    for (const day of scheduleDays) {
      map[day].sort((a, b) => {
        const byTime = timeLabel(a.start_time).localeCompare(timeLabel(b.start_time))
        if (byTime !== 0) return byTime
        return a.title.localeCompare(b.title)
      })
    }
    return map
  }, [items])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CoordinationAgendaEvent[]> = {}
    for (const event of events) {
      const key = normalizeDateInput(event.event_date)
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push(event)
    }

    for (const dateKey of Object.keys(map)) {
      map[dateKey].sort((a, b) => {
        const byTime = timeLabel(a.start_time).localeCompare(timeLabel(b.start_time))
        if (byTime !== 0) return byTime
        return a.title.localeCompare(b.title)
      })
    }

    return map
  }, [events])

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, CoordinationTask[]> = { todo: [], doing: [], done: [] }
    for (const task of tasks) {
      map[task.status].push(task)
    }
    for (const status of taskColumns) {
      map[status].sort((a, b) => {
        const byPriority = taskPriorityRank(a.priority) - taskPriorityRank(b.priority)
        if (byPriority !== 0) return byPriority

        const ad = normalizeDateInput(a.due_date)
        const bd = normalizeDateInput(b.due_date)
        if (ad && bd) {
          const byDate = ad.localeCompare(bd)
          if (byDate !== 0) return byDate
        }
        if (ad && !bd) return -1
        if (!ad && bd) return 1
        return a.title.localeCompare(b.title)
      })
    }
    return map
  }, [tasks])

  function statusLabel(status: TaskStatus) {
    if (status === "doing") return t.colDoing
    if (status === "done") return t.colDone
    return t.colTodo
  }

  function priorityLabel(priority: TaskPriority) {
    if (priority === "high") return t.priorityHigh
    if (priority === "medium") return t.priorityMedium
    return t.priorityLow
  }

  function resetAgendaForm() {
    setAgendaForm({
      title: "",
      repeatWeekly: true,
      weekdays: [1],
      event_date: defaultEventDate(),
      start_time: "09:00",
      end_time: "10:00",
      timezone: defaultTimezone,
      active: true,
    })
    setAgendaError("")
  }

  function toggleAgendaWeekday(weekday: number) {
    setAgendaForm((prev) => {
      const exists = prev.weekdays.includes(weekday)
      const weekdays = exists
        ? prev.weekdays.filter((day) => day !== weekday)
        : [...prev.weekdays, weekday].sort((a, b) => a - b)
      return { ...prev, weekdays }
    })
  }

  function resetTaskForm() {
    setTaskForm({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      due_date: "",
    })
    setTaskError("")
  }

  async function loadAgenda() {
    setLoadingAgenda(true)
    try {
      setAgendaError("")

      const [fixedRes, eventsRes] = await Promise.all([
        fetch("/api/admin/coordinator-schedules", { cache: "no-store" }),
        fetch("/api/admin/coordination-agenda-events", { cache: "no-store" }),
      ])

      const [fixedData, eventsData] = await Promise.all([
        fixedRes.json().catch(() => null),
        eventsRes.json().catch(() => null),
      ])

      if (!fixedRes.ok || !eventsRes.ok) {
        setAgendaError((!fixedRes.ok ? fixedData?.error : eventsData?.error) ?? t.loadError)
        setItems([])
        setEvents([])
        return
      }

      setItems(Array.isArray(fixedData) ? fixedData : [])
      const normalizedEvents = Array.isArray(eventsData)
        ? eventsData.map((event) => ({ ...event, event_date: normalizeDateInput(event.event_date) }))
        : []
      setEvents(normalizedEvents)
    } catch {
      setAgendaError(t.loadError)
      setItems([])
      setEvents([])
    } finally {
      setLoadingAgenda(false)
    }
  }

  async function loadTasks() {
    setLoadingTasks(true)
    try {
      setTaskError("")
      const res = await fetch("/api/admin/coordination-tasks", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setTaskError(data?.error ?? t.loadError)
        setTasks([])
        return
      }
      const normalized = Array.isArray(data)
        ? data.map((task) => ({ ...task, due_date: normalizeDateInput(task.due_date) || null }))
        : []
      setTasks(normalized)
    } catch {
      setTaskError(t.loadError)
      setTasks([])
    } finally {
      setLoadingTasks(false)
    }
  }

  async function loadAll() {
    await Promise.all([loadAgenda(), loadTasks()])
  }

  async function refreshActiveTab() {
    if (tab === "agenda") {
      await loadAgenda()
      return
    }
    await loadTasks()
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEditAgenda(item: CoordinationAgendaItem) {
    setEditingAgendaId(item.id)
    setEditingEventId(null)
    setAgendaError("")
    setAgendaForm({
      title: item.title,
      repeatWeekly: true,
      weekdays: [item.weekday],
      event_date: defaultEventDate(),
      start_time: timeLabel(item.start_time),
      end_time: timeLabel(item.end_time),
      timezone: item.timezone,
      active: item.active,
    })
  }

  function startEditEvent(event: CoordinationAgendaEvent) {
    setEditingEventId(event.id)
    setEditingAgendaId(null)
    setAgendaError("")
    setAgendaForm({
      title: event.title,
      repeatWeekly: false,
      weekdays: [1],
      event_date: normalizeDateInput(event.event_date),
      start_time: timeLabel(event.start_time),
      end_time: timeLabel(event.end_time),
      timezone: event.timezone,
      active: event.active,
    })
  }

  async function handleDeleteAgenda(id: string) {
    if (!confirm(t.removeConfirm)) return

    const res = await fetch(`/api/admin/coordinator-schedules/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setAgendaError(data?.error ?? t.genericError)
      return
    }

    if (editingAgendaId === id) {
      setEditingAgendaId(null)
      resetAgendaForm()
    }
    await loadAgenda()
  }

  async function handleSubmitAgenda(e: React.FormEvent) {
    e.preventDefault()

    const title = agendaForm.title.trim()
    if (!title) {
      setAgendaError(t.commitmentRequired)
      return
    }

    const repeatWeekly = editingAgendaId ? true : editingEventId ? false : agendaForm.repeatWeekly
    const weekdays = agendaForm.weekdays
      .filter((day) => scheduleDays.includes(day))
      .sort((a, b) => a - b)
    const eventDate = normalizeDateInput(agendaForm.event_date)

    if (repeatWeekly && weekdays.length === 0) {
      setAgendaError(t.weekdaysRequired)
      return
    }

    if (!repeatWeekly && !eventDate) {
      setAgendaError(t.eventDateRequired)
      return
    }

    const basePayload = {
      title,
      start_time: agendaForm.start_time,
      end_time: agendaForm.end_time,
      timezone: agendaForm.timezone,
      active: agendaForm.active,
    }

    setSavingAgenda(true)
    setAgendaError("")

    try {
      if (editingAgendaId) {
        const res = await fetch(`/api/admin/coordinator-schedules/${editingAgendaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, weekday: weekdays[0] }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setAgendaError(data?.error ?? t.genericError)
          return
        }
      } else if (editingEventId) {
        const res = await fetch(`/api/admin/coordination-agenda-events/${editingEventId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, event_date: eventDate }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setAgendaError(data?.error ?? t.genericError)
          return
        }
      } else if (repeatWeekly) {
        const responses = await Promise.all(
          weekdays.map((weekday) =>
            fetch("/api/admin/coordinator-schedules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...basePayload, weekday }),
            }),
          ),
        )
        const failed = responses.find((response) => !response.ok)
        if (failed) {
          const data = await failed.json().catch(() => null)
          setAgendaError(data?.error ?? t.genericError)
          return
        }
      } else {
        const res = await fetch("/api/admin/coordination-agenda-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, event_date: eventDate }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setAgendaError(data?.error ?? t.genericError)
          return
        }
      }

      setEditingAgendaId(null)
      setEditingEventId(null)
      resetAgendaForm()
      await loadAgenda()
    } finally {
      setSavingAgenda(false)
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm(t.eventRemoveConfirm)) return

    const res = await fetch(`/api/admin/coordination-agenda-events/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setAgendaError(data?.error ?? t.genericError)
      return
    }

    if (editingEventId === id) {
      setEditingEventId(null)
      resetAgendaForm()
    }
    await loadAgenda()
  }

  function startEditTask(task: CoordinationTask) {
    setEditingTaskId(task.id)
    setTaskError("")
    setTaskForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      due_date: normalizeDateInput(task.due_date),
    })
  }

  async function handleDeleteTask(id: string) {
    if (!confirm(t.taskDeleteConfirm)) return

    const res = await fetch(`/api/admin/coordination-tasks/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setTaskError(data?.error ?? t.genericError)
      return
    }

    if (editingTaskId === id) {
      setEditingTaskId(null)
      resetTaskForm()
    }
    await loadTasks()
  }

  async function updateTaskStatus(task: CoordinationTask, nextStatus: TaskStatus) {
    const res = await fetch(`/api/admin/coordination-tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        description: task.description ?? "",
        status: nextStatus,
        priority: task.priority,
        due_date: normalizeDateInput(task.due_date),
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setTaskError(data?.error ?? t.genericError)
      return
    }

    await loadTasks()
  }

  async function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault()

    const title = taskForm.title.trim()
    if (!title) {
      setTaskError(t.taskTitleRequired)
      return
    }

    setSavingTask(true)
    setTaskError("")

    const url = editingTaskId
      ? `/api/admin/coordination-tasks/${editingTaskId}`
      : "/api/admin/coordination-tasks"
    const method = editingTaskId ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        due_date: taskForm.due_date,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setTaskError(data?.error ?? t.genericError)
      setSavingTask(false)
      return
    }

    setEditingTaskId(null)
    resetTaskForm()
    await loadTasks()
    setSavingTask(false)
  }

  const agendaModeLocked = Boolean(editingAgendaId || editingEventId)
  const isRepeatMode = editingAgendaId ? true : editingEventId ? false : agendaForm.repeatWeekly
  const weekChip = weekOffset === 0 ? t.weekCurrent : `${t.weekFuture} +${weekOffset}`
  const weekRangeLabel = formatWeekRange(weekStart, weekEnd, locale)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-300" />
            {t.title}
          </h1>
          <p className="text-slate-400 text-sm">{t.subtitle}</p>
        </div>

        <Button
          onClick={refreshActiveTab}
          className="bg-white/10 hover:bg-white/15 border border-white/10"
          disabled={tab === "agenda" ? loadingAgenda : loadingTasks}
        >
          <RefreshCcw
            className={`w-4 h-4 mr-2 ${(tab === "agenda" ? loadingAgenda : loadingTasks) ? "animate-spin" : ""}`}
          />
          {t.refresh}
        </Button>
      </div>

      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1">
        <button
          type="button"
          onClick={() => setTab("agenda")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            tab === "agenda" ? "bg-cyan-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          {t.tabAgenda}
        </button>
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            tab === "tasks" ? "bg-cyan-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          {t.tabTasks}
        </button>
      </div>

      {tab === "agenda" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6">
          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-white text-base">{editingAgendaId || editingEventId ? t.formEdit : t.formAdd}</CardTitle>
              {agendaModeLocked && <p className="text-xs text-white/60">{t.editModeLocked}</p>}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitAgenda} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400">{t.commitment}</label>
                  <input
                    value={agendaForm.title}
                    onChange={(e) => setAgendaForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={t.commitmentPlaceholder}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">{t.repeatModeLabel}</label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <input
                        type="radio"
                        name="agenda-repeat-mode"
                        checked={isRepeatMode}
                        onChange={() => setAgendaForm((prev) => ({ ...prev, repeatWeekly: true }))}
                        disabled={agendaModeLocked}
                        className="accent-cyan-500"
                      />
                      <span className="text-sm text-white/90">{t.repeatWeekly}</span>
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <input
                        type="radio"
                        name="agenda-repeat-mode"
                        checked={!isRepeatMode}
                        onChange={() => setAgendaForm((prev) => ({ ...prev, repeatWeekly: false }))}
                        disabled={agendaModeLocked}
                        className="accent-cyan-500"
                      />
                      <span className="text-sm text-white/90">{t.noRepeat}</span>
                    </label>
                  </div>
                </div>

                {isRepeatMode ? (
                  <div>
                    <label className="text-xs text-slate-400">{t.weekdays}</label>
                    {editingAgendaId ? (
                      <select
                        value={agendaForm.weekdays[0] ?? 1}
                        onChange={(e) =>
                          setAgendaForm((prev) => ({ ...prev, weekdays: [Number(e.target.value)] }))
                        }
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                      >
                        {scheduleDays.map((day) => (
                          <option key={day} value={day}>
                            {weekdayLabel(day, locale)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {scheduleDays.map((day) => {
                          const selected = agendaForm.weekdays.includes(day)
                          return (
                            <label
                              key={day}
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                                selected
                                  ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-100"
                                  : "border-white/10 bg-white/5 text-white/80"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleAgendaWeekday(day)}
                                className="accent-cyan-500"
                              />
                              {weekdayLabel(day, locale)}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-400">{t.eventDate}</label>
                    <input
                      type="date"
                      value={agendaForm.event_date}
                      onChange={(e) => setAgendaForm((prev) => ({ ...prev, event_date: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">{t.start}</label>
                    <input
                      type="time"
                      value={agendaForm.start_time}
                      onChange={(e) => setAgendaForm((prev) => ({ ...prev, start_time: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">{t.end}</label>
                    <input
                      type="time"
                      value={agendaForm.end_time}
                      onChange={(e) => setAgendaForm((prev) => ({ ...prev, end_time: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400">{t.timezone}</label>
                  <select
                    value={agendaForm.timezone}
                    onChange={(e) => setAgendaForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  >
                    {timezoneOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="coordination-agenda-active"
                    type="checkbox"
                    checked={agendaForm.active}
                    onChange={(e) => setAgendaForm((prev) => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <label htmlFor="coordination-agenda-active" className="text-sm text-white/80">
                    {t.active}
                  </label>
                </div>

                {agendaError && <p className="text-xs text-rose-300">{agendaError}</p>}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={savingAgenda}>
                    {editingAgendaId || editingEventId ? t.save : t.add}
                  </Button>
                  {(editingAgendaId || editingEventId) && (
                    <Button
                      type="button"
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                      onClick={() => {
                        setEditingAgendaId(null)
                        setEditingEventId(null)
                        resetAgendaForm()
                      }}
                    >
                      {t.cancel}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-white text-base">{t.weekTitle}</CardTitle>
                <p className="text-xs text-white/60 mt-1">{weekRangeLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-white/80 border border-white/10">
                  {weekChip}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
                  disabled={weekOffset === 0}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/80 disabled:opacity-40"
                  title={t.weekBack}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-white/80"
                  title={t.weekForward}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAgenda && <p className="text-slate-400">{t.loading}</p>}
              {!loadingAgenda &&
                scheduleDays.every((day) => {
                  const dateKey = normalizeDateInput(weekDates[day])
                  return (agendaByWeekday[day]?.length ?? 0) === 0 && (eventsByDate[dateKey]?.length ?? 0) === 0
                }) && <p className="text-slate-400">{t.noSchedules}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {scheduleDays.map((day) => {
                  const fixedList = agendaByWeekday[day] ?? []
                  const dateKey = normalizeDateInput(weekDates[day])
                  const variableList = eventsByDate[dateKey] ?? []
                  const list = [
                    ...fixedList.map((item) => ({ kind: "fixed" as const, data: item })),
                    ...variableList.map((event) => ({ kind: "variable" as const, data: event })),
                  ].sort((a, b) => {
                    const byTime = timeLabel(a.data.start_time).localeCompare(timeLabel(b.data.start_time))
                    if (byTime !== 0) return byTime
                    return a.data.title.localeCompare(b.data.title)
                  })
                  const dateLabel = formatDayDate(weekDates[day], locale)
                  return (
                    <div key={day} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/80">
                        {weekdayLabel(day, locale)} - {dateLabel}
                      </div>
                      <div className="p-3 space-y-3">
                        {list.length === 0 && <p className="text-xs text-slate-400">{t.dayEmpty}</p>}

                        {list.map((entry) => (
                          <div
                            key={entry.data.id}
                            className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-3"
                          >
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-white">{entry.data.title}</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-[11px] font-semibold text-cyan-100 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                  {timeLabel(entry.data.start_time)} - {timeLabel(entry.data.end_time)}
                                </span>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                    entry.kind === "fixed"
                                      ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  }`}
                                >
                                  {entry.kind === "fixed" ? t.badgeFixed : t.badgeVariable}
                                </span>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                    entry.data.active
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                  }`}
                                >
                                  {entry.data.active ? t.statusActive : t.statusInactive}
                                </span>
                              </div>
                            </div>

                            <div className="text-xs text-white/50">{getTimezoneLabel(entry.data.timezone)}</div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (entry.kind === "fixed") startEditAgenda(entry.data)
                                  else startEditEvent(entry.data)
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {t.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (entry.kind === "fixed") handleDeleteAgenda(entry.data.id)
                                  else handleDeleteEvent(entry.data.id)
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200"
                              >
                                <Trash className="w-3.5 h-3.5" />
                                {t.remove}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6">
          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-cyan-300" />
                {editingTaskId ? t.taskEdit : t.taskAdd}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTask} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400">{t.taskTitle}</label>
                  <input
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">{t.taskDesc}</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    placeholder={t.taskDescPlaceholder}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">{t.taskStatus}</label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                    >
                      {taskColumns.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">{t.taskPriority}</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                    >
                      <option value="high">{t.priorityHigh}</option>
                      <option value="medium">{t.priorityMedium}</option>
                      <option value="low">{t.priorityLow}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400">{t.taskDue}</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
                  />
                </div>

                {taskError && <p className="text-xs text-rose-300">{taskError}</p>}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={savingTask}>
                    {editingTaskId ? t.save : t.add}
                  </Button>
                  {editingTaskId && (
                    <Button
                      type="button"
                      className="bg-white/10 hover:bg-white/15 border border-white/10"
                      onClick={() => {
                        setEditingTaskId(null)
                        resetTaskForm()
                      }}
                    >
                      {t.cancel}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/30 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">{t.tasksTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTasks && <p className="text-slate-400">{t.loading}</p>}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {taskColumns.map((status) => {
                  const list = tasksByStatus[status]
                  return (
                    <div key={status} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/80">
                        {statusLabel(status)} ({list.length})
                      </div>
                      <div className="p-3 space-y-3 min-h-[220px]">
                        {!loadingTasks && list.length === 0 && (
                          <p className="text-xs text-slate-400">{t.taskNoCards}</p>
                        )}

                        {list.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-3"
                          >
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-white">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-white/70 whitespace-pre-wrap">{task.description}</p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 text-[11px]">
                              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/10 text-white/80">
                                {priorityLabel(task.priority)}
                              </span>
                              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/10 text-white/70">
                                {t.taskDue}: {formatDate(task.due_date, locale)}
                              </span>
                            </div>

                            <div>
                              <select
                                value={task.status}
                                onChange={(e) => updateTaskStatus(task, e.target.value as TaskStatus)}
                                className="w-full px-2 py-1.5 rounded-lg bg-slate-900/60 border border-white/10 text-xs text-white"
                              >
                                {taskColumns.map((option) => (
                                  <option key={option} value={option}>
                                    {statusLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditTask(task)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {t.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200"
                              >
                                <Trash className="w-3.5 h-3.5" />
                                {t.remove}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
