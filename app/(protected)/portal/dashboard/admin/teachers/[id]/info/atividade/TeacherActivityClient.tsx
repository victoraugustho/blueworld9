"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, CalendarRange, RefreshCcw, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type DashboardActivity = {
  teacher: {
    name: string
    email: string
  }
  period: {
    from: string
    to: string
    school_year: number
  }
  access: {
    last_login_at: string | null
    login_count_period: number
    active_sessions: number
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
    daily_activity: Array<{ day: string; total_actions: number; failed_actions: number }>
    recent_logs: Array<{
      id: string
      action: string
      status: string | null
      request_path: string | null
      created_at: string
    }>
  }
}

type PresetDays = 7 | 15 | 30 | 90

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

function safePercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return (value / total) * 100
}

function mapPreset(days: PresetDays) {
  return {
    from: daysAgoIsoDate(days),
    to: todayIsoDate(),
  }
}

export default function TeacherActivityClient({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<DashboardActivity | null>(null)
  const [fromDate, setFromDate] = useState(daysAgoIsoDate(30))
  const [toDate, setToDate] = useState(todayIsoDate())
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear())

  const maxDaily = useMemo(() => {
    const values = (data?.activity.daily_activity ?? []).map((item) => item.total_actions)
    const max = Math.max(...values, 0)
    return max > 0 ? max : 1
  }, [data?.activity.daily_activity])

  const operationalLogs = useMemo(
    () =>
      (data?.activity.recent_logs ?? []).filter(
        (item) => !String(item.action ?? "").toLowerCase().startsWith("auth.login"),
      ),
    [data?.activity.recent_logs],
  )

  const loginLogs = useMemo(
    () =>
      (data?.activity.recent_logs ?? []).filter((item) =>
        String(item.action ?? "").toLowerCase().startsWith("auth.login"),
      ),
    [data?.activity.recent_logs],
  )

  async function loadData() {
    const params = new URLSearchParams()
    params.set("from", fromDate)
    params.set("to", toDate)
    params.set("schoolYear", String(schoolYear))

    const res = await fetch(`/api/admin/teachers/${teacherId}/dashboard?${params.toString()}`, {
      cache: "no-store",
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(String(json?.error ?? "Erro ao carregar atividade."))
    }
    setData(json)
  }

  async function initialLoad() {
    setLoading(true)
    setError("")
    try {
      await loadData()
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
      await loadData()
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
          <h1 className="text-2xl font-bold">Atividade e uso do portal</h1>
          {data?.teacher ? (
            <p className="text-sm text-slate-300 mt-1">
              {data.teacher.name} • {data.teacher.email}
            </p>
          ) : (
            <p className="text-sm text-slate-300 mt-1">Monitoramento por periodo para gestao administrativa.</p>
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
            Filtro de periodo
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
                Aplicar
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset(7)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(15)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              15 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              30 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(90)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              90 dias
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-slate-400">Carregando atividade...</p>}
      {!loading && error && <p className="text-rose-300">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Acoes no periodo</p>
                <p className="text-xl font-semibold text-white mt-1">{data.activity.summary.total_actions}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Acoes operacionais</p>
                <p className="text-xl font-semibold text-cyan-200 mt-1">{data.activity.summary.operational_actions}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Logins</p>
                <p className="text-xl font-semibold text-amber-200 mt-1">{data.activity.summary.login_actions}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Sucesso</p>
                <p className="text-xl font-semibold text-emerald-300 mt-1">{data.activity.summary.success_actions}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Falhas</p>
                <p className="text-xl font-semibold text-rose-300 mt-1">{data.activity.summary.failed_actions}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Acoes unicas</p>
                <p className="text-xl font-semibold text-white mt-1">{data.activity.summary.unique_actions}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Logins no periodo</p>
                <p className="text-xl font-semibold text-white mt-1">{data.access.login_count_period}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardContent className="pt-4">
                <p className="text-xs text-white/60">Sessoes ativas</p>
                <p className="text-xl font-semibold text-white mt-1">{data.access.active_sessions}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10 xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-300" />
                  Tendencia diaria de atividade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.activity.daily_activity.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem registros no periodo selecionado.</p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                    {data.activity.daily_activity.map((item) => {
                      const width = (item.total_actions / maxDaily) * 100
                      const failRate = safePercent(item.failed_actions, item.total_actions)
                      return (
                        <div key={item.day} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-white/70">
                            <span>{formatDate(item.day)}</span>
                            <span>
                              {item.total_actions} acoes • {item.failed_actions} falhas ({failRate.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${Math.max(3, width)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                  Sessao e acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Sessoes ativas</span>
                  <span className="text-white">{data.access.active_sessions}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Ultima atividade</span>
                  <span className="text-white">{formatDateTime(data.access.last_operational_activity_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Ultimo login</span>
                  <span className="text-white">{formatDateTime(data.access.last_login_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/70">Ultima atividade no periodo</span>
                  <span className="text-white">{formatDateTime(data.activity.summary.last_operational_activity_in_period)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-slate-900/30 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Top acoes</CardTitle>
              </CardHeader>
              <CardContent>
                {data.activity.top_actions.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem acoes no periodo.</p>
                ) : (
                  <div className="space-y-2">
                    {data.activity.top_actions.map((item) => (
                      <div key={item.action} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
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
                <CardTitle className="text-white text-base">Atividades recentes (sem login)</CardTitle>
              </CardHeader>
              <CardContent>
                {operationalLogs.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem atividades operacionais no periodo.</p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                    {operationalLogs.map((item) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-white truncate">{item.action}</p>
                          <span
                            className={`text-[11px] rounded-full border px-2 py-0.5 ${
                              item.status === "failed"
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            }`}
                          >
                            {item.status || "success"}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/55 mt-1">
                          {formatDateTime(item.created_at)}
                          {item.request_path ? ` • ${item.request_path}` : ""}
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
              <CardTitle className="text-white text-base">Logins recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {loginLogs.length === 0 ? (
                <p className="text-sm text-slate-400">Sem logins no periodo.</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
                  {loginLogs.map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-white truncate">{item.action}</p>
                        <span className="text-[11px] rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 px-2 py-0.5">
                          login
                        </span>
                      </div>
                      <p className="text-[11px] text-white/55 mt-1">{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
