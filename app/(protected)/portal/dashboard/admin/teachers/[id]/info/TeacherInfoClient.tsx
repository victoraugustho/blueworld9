"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarRange, CheckCircle2, CircleHelp, Clock3, RefreshCcw, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type DashboardResponse = {
  teacher: {
    id: string
    name: string
    email: string
    country: "BR" | "UY" | "PY"
    locale: "pt-BR" | "es"
    approved: boolean
    active: boolean
    categories: Array<{ id: number; name: string }>
    student_years: number[]
  }
  period: {
    from: string
    to: string
    days: number
    school_year: number
  }
  kpis: {
    performance_index: number
    performance_level: "excelente" | "bom" | "atencao" | "critico"
    lesson_diary_coverage_percent: number
    launch_completion_percent: number
    attendance_coverage_percent: number
    final_grades_coverage_percent: number
    freshness_score: number
    alerts: string[]
  }
  access: {
    last_login_at: string | null
    login_count_period: number
    active_sessions: number
    last_session: { created_at: string; ip: string | null; user_agent: string | null } | null
    last_activity_at: string | null
    last_operational_activity_at: string | null
  }
  activity: {
    summary: {
      total_actions: number
      success_actions: number
      failed_actions: number
      unique_actions: number
      unique_paths: number
      last_activity_in_period: string | null
      last_operational_activity_in_period: string | null
      login_actions: number
      operational_actions: number
    }
    top_actions: Array<{ action: string; total: number }>
  }
  agenda: {
    total_slots: number
    active_slots: number
    class_slots: number
    event_slots: number
    recurring_slots: number
    one_off_slots: number
    one_off_in_period: number
  }
  lessons: {
    total_lessons: number
    classes_touched: number
    lessons_with_grades: number
    lessons_without_grades: number
    lessons_with_notes: number
    lessons_with_observations: number
    last_lesson_date: string | null
    by_class: Array<{ class_name: string; lessons_count: number; last_lesson_date: string | null }>
    recent: Array<{
      id: string
      class_name: string
      lesson_date: string
      lesson_number: number
      bimester: number | null
      has_grades: boolean
      notes: string | null
      observations: string | null
    }>
  }
  gradebook: {
    overview: {
      class_count: number
      active_class_count: number
      student_count: number
      active_student_count: number
      lesson_count: number
    }
    progress_period: {
      grade_lessons_count: number
      expected_students_total: number
      completed_students_total: number
      attendance_marked_total: number
      absences_total: number
      fully_completed_lessons: number
      no_grade_lessons: number
    }
    final_coverage: {
      total_targets: number
      completed_targets: number
      by_bimester: Array<{
        bimester: number
        total_targets: number
        completed_targets: number
        class_count: number
        closed_class_count: number
      }>
    }
    classes: Array<{
      id: string
      name: string
      student_year: number | null
      active: boolean
      lessons_count: number
      expected_students_total: number
      completed_students_total: number
      completion_percent: number
      absences_total: number
      last_lesson_date: string | null
    }>
  }
  reminders: {
    total: number
    done: number
    pending: number
    created_in_period: number
    last_update_at: string | null
  }
  video: {
    all_time: {
      tracked_videos: number
      started_videos: number
      watched_videos: number
      avg_progress: number
    }
    in_period: {
      tracked_videos: number
      started_videos: number
      watched_videos: number
      avg_progress: number
    }
  }
}

type PresetDays = 7 | 15 | 30 | 90

function countryLabel(value: "BR" | "UY" | "PY") {
  if (value === "BR") return "Brasil"
  if (value === "UY") return "Uruguai"
  return "Paraguai"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("pt-BR")
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("pt-BR")
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function todayIsoDate() {
  const now = new Date()
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return toIsoDate(utc)
}

function daysAgoIsoDate(days: number) {
  const now = new Date()
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  utc.setUTCDate(utc.getUTCDate() - days + 1)
  return toIsoDate(utc)
}

function pctLabel(value: number) {
  return `${Number(value ?? 0).toFixed(1).replace(".", ",")}%`
}

function scoreTone(level: DashboardResponse["kpis"]["performance_level"]) {
  if (level === "excelente") return "text-emerald-300 border-emerald-500/30 bg-emerald-500/15"
  if (level === "bom") return "text-cyan-200 border-cyan-500/30 bg-cyan-500/15"
  if (level === "atencao") return "text-amber-200 border-amber-500/30 bg-amber-500/15"
  return "text-rose-200 border-rose-500/30 bg-rose-500/15"
}

function mapPreset(days: PresetDays) {
  return {
    from: daysAgoIsoDate(days),
    to: todayIsoDate(),
  }
}

export default function TeacherInfoClient({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [fromDate, setFromDate] = useState(daysAgoIsoDate(30))
  const [toDate, setToDate] = useState(todayIsoDate())
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear())

  const topCards = useMemo(() => {
    if (!data) return []
    return [
      {
        label: "Indice de desempenho",
        value: data.kpis.performance_index.toFixed(1).replace(".", ","),
        hint: data.kpis.performance_level.toUpperCase(),
        info: "Score composto: diário (25%), lançamento de notas (35%), notas finais (30%) e atividade recente (10%).",
      },
      {
        label: "Ultimo acesso",
        value: formatDateTime(data.access.last_login_at),
        hint: `${data.access.active_sessions} sessoes ativas`,
        info: "Mostra o último login válido do professor no portal e quantas sessões ainda estão abertas.",
      },
      {
        label: "Acoes no periodo",
        value: String(data.activity.summary.total_actions),
        hint: `${data.activity.summary.operational_actions} operacionais / ${data.activity.summary.login_actions} logins`,
        info: "Total de ações registradas no período filtrado (auditoria e, quando necessário, eventos operacionais derivados).",
      },
      {
        label: "Aulas no periodo",
        value: String(data.lessons.total_lessons),
        hint: `${data.lessons.classes_touched} turmas com atividade`,
        info: "Quantidade de aulas registradas no período e em quantas turmas houve movimentação.",
      },
      {
        label: "Cobertura de diario",
        value: pctLabel(data.kpis.lesson_diary_coverage_percent),
        hint: `${data.lessons.lessons_with_notes} aulas com diario`,
        info: "Percentual de aulas que possuem diário/notes preenchido.",
      },
      {
        label: "Cobertura de lancamento",
        value: pctLabel(data.kpis.launch_completion_percent),
        hint: `${data.gradebook.progress_period.fully_completed_lessons} aulas 100%`,
        info: "Percentual de lançamentos completos por aluno nas aulas com nota (presença + critérios C1-C4).",
      },
      {
        label: "Cobertura de notas finais",
        value: pctLabel(data.kpis.final_grades_coverage_percent),
        hint: `${data.gradebook.final_coverage.completed_targets}/${data.gradebook.final_coverage.total_targets}`,
        info: "Percentual de notas finais bimestrais concluídas (incluindo C5 e Prova/Atividade conforme regra).",
      },
      {
        label: "Presenca registrada",
        value: pctLabel(data.kpis.attendance_coverage_percent),
        hint: `${data.gradebook.progress_period.absences_total} faltas no periodo`,
        info: "Percentual de presença/falta efetivamente lançada para os alunos esperados nas aulas.",
      },
    ]
  }, [data])

  async function loadDashboard() {
    if (!teacherId) return
    const params = new URLSearchParams()
    params.set("from", fromDate)
    params.set("to", toDate)
    params.set("schoolYear", String(schoolYear))

    const res = await fetch(`/api/admin/teachers/${teacherId}/dashboard?${params.toString()}`, {
      cache: "no-store",
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(String(json?.error ?? "Nao foi possivel carregar indicadores."))
    }
    setData(json)
  }

  async function initialLoad() {
    setLoading(true)
    setError("")
    try {
      await loadDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initialLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  async function refresh() {
    setRefreshing(true)
    setError("")
    try {
      await loadDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar.")
    } finally {
      setRefreshing(false)
    }
  }

  function applyPreset(days: PresetDays) {
    const range = mapPreset(days)
    setFromDate(range.from)
    setToDate(range.to)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard de desempenho</h1>
          {data?.teacher ? (
            <p className="text-sm text-slate-300 mt-1">
              {data.teacher.name} • {data.teacher.email} • {countryLabel(data.teacher.country)}
            </p>
          ) : (
            <p className="text-sm text-slate-300 mt-1">Visao executiva de KPIs do professor.</p>
          )}
        </div>
        <Button onClick={refresh} className="bg-white/10 hover:bg-white/15 border border-white/10" disabled={loading || refreshing}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-cyan-300" />
            Parametros da analise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs text-white/70 space-y-1">
              <span>Data inicial</span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-white/70 space-y-1">
              <span>Data final</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-white/70 space-y-1">
              <span>Ano letivo</span>
              <input
                type="number"
                min={2020}
                max={2100}
                value={schoolYear}
                onChange={(event) => setSchoolYear(Number(event.target.value) || new Date().getFullYear())}
                className="w-full rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex items-end">
              <Button onClick={refresh} className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={loading || refreshing}>
                Aplicar periodo
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset(7)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              Ultimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(15)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              Ultimos 15 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              Ultimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(90)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              Ultimos 90 dias
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-slate-400">Carregando indicadores...</p>}
      {!loading && error && <p className="text-rose-300">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {topCards.map((card) => (
              <Card key={card.label} className="bg-slate-900/30 backdrop-blur-md border border-white/10">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <span>{card.label}</span>
                    <span className="relative inline-flex group">
                      <button
                        type="button"
                        className="text-white/45 hover:text-cyan-300 transition-colors"
                        aria-label={`Explicação de ${card.label}`}
                        title={card.info}
                      >
                        <CircleHelp className="w-3.5 h-3.5" />
                      </button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-md border border-white/15 bg-slate-950/95 px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                        {card.info}
                      </span>
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-white mt-1">{card.value}</p>
                  <p className="text-[11px] text-white/45 mt-1">{card.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10 xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-300" />
                  Qualidade operacional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white/75">Score geral</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${scoreTone(data.kpis.performance_level)}`}>
                    {data.kpis.performance_level.toUpperCase()} • {data.kpis.performance_index.toFixed(1).replace(".", ",")}
                  </span>
                  <span className="text-xs text-white/50">
                    Periodo: {formatDate(data.period.from)} a {formatDate(data.period.to)} ({data.period.days} dias)
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                      <span>Cobertura de diario</span>
                      <span>{pctLabel(data.kpis.lesson_diary_coverage_percent)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(100, data.kpis.lesson_diary_coverage_percent))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                      <span>Cobertura de lancamento de notas</span>
                      <span>{pctLabel(data.kpis.launch_completion_percent)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, data.kpis.launch_completion_percent))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                      <span>Cobertura de notas finais</span>
                      <span>{pctLabel(data.kpis.final_grades_coverage_percent)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, data.kpis.final_grades_coverage_percent))}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                      <span>Frequencia de atividade recente</span>
                      <span>{pctLabel(data.kpis.freshness_score)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, data.kpis.freshness_score))}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-300" />
                  Alertas gerenciais
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.kpis.alerts.length === 0 ? (
                  <p className="text-sm text-emerald-300">Sem alertas no periodo selecionado.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.kpis.alerts.map((alert) => (
                      <li key={alert} className="text-xs text-amber-100 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
                        {alert}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-cyan-300" />
                  Acesso e uso do portal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Ultimo login</span>
                  <span className="text-white">{formatDateTime(data.access.last_login_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Ultima atividade (sem login)</span>
                  <span className="text-white">{formatDateTime(data.access.last_operational_activity_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Logins no periodo</span>
                  <span className="text-white">{data.access.login_count_period}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Sessoes ativas</span>
                  <span className="text-white">{data.access.active_sessions}</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                  <p>Ultima sessao: {formatDateTime(data.access.last_session?.created_at)}</p>
                  <p className="truncate mt-1">IP: {data.access.last_session?.ip || "-"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                  Operacao por turma (periodo)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.gradebook.classes.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem turmas para o ano selecionado.</p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                    {data.gradebook.classes.map((item) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white truncate">{item.name}</p>
                          <span className="text-[11px] text-white/70">{pctLabel(item.completion_percent)}</span>
                        </div>
                        <p className="text-[11px] text-white/55 mt-1">
                          {item.lessons_count} aulas • {item.completed_students_total}/{item.expected_students_total} lancamentos • {item.absences_total} faltas
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Cobertura final por bimestre</CardTitle>
            </CardHeader>
            <CardContent>
              {data.gradebook.final_coverage.by_bimester.length === 0 ? (
                <p className="text-sm text-slate-400">Sem dados de fechamento para o ano selecionado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {data.gradebook.final_coverage.by_bimester.map((item) => {
                    const pct = item.total_targets > 0 ? (item.completed_targets / item.total_targets) * 100 : 0
                    return (
                      <div key={item.bimester} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-sm text-white font-medium">Bimestre {item.bimester}</p>
                        <p className="text-xs text-white/65 mt-1">
                          {item.completed_targets}/{item.total_targets} finais • {pctLabel(pct)}
                        </p>
                        <p className="text-[11px] text-white/50 mt-1">
                          Turmas fechadas: {item.closed_class_count}/{item.class_count}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Top acoes no periodo</CardTitle>
              </CardHeader>
              <CardContent>
                {data.activity.top_actions.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma acao registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {data.activity.top_actions.map((item) => (
                      <div key={item.action} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <p className="text-xs text-white truncate">{item.action}</p>
                        <span className="text-xs text-cyan-200">{item.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Aulas recentes no periodo</CardTitle>
              </CardHeader>
              <CardContent>
                {data.lessons.recent.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem aulas no periodo.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                    {data.lessons.recent.slice(0, 20).map((lesson) => (
                      <div key={lesson.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">{lesson.class_name}</span>
                          <span>Aula {lesson.lesson_number}</span>
                          <span>{formatDate(lesson.lesson_date)}</span>
                          <span className={lesson.has_grades ? "text-emerald-300" : "text-amber-300"}>
                            {lesson.has_grades ? "Com nota" : "Sem nota"}
                          </span>
                        </div>
                        <p className="text-xs text-white/80 mt-1 line-clamp-2">{lesson.notes || "Sem diario."}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
