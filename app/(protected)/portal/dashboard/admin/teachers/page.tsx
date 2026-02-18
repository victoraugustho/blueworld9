"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import type { Teacher } from "@/app/types/portal"
import {
  Search,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  CheckCircle2,
  Ban,
  RotateCcw,
  RefreshCcw,
} from "lucide-react"

type TeachersGrouped = {
  approved: Teacher[]
  pending: Teacher[]
  disabled: Teacher[]
}

type Tab = "approved" | "pending" | "disabled"
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

function statusBadge(tab: Tab) {
  if (tab === "pending")
    return { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20" }
  if (tab === "approved")
    return { label: "Aprovado", cls: "bg-green-500/15 text-green-300 border border-green-500/20" }
  return { label: "Desativado", cls: "bg-red-500/15 text-red-300 border border-red-500/20" }
}

function normalize(v: any) {
  return String(v ?? "").trim().toLowerCase()
}

function groupByCountry(list: Teacher[]) {
  const groups: Record<string, Teacher[]> = { BR: [], UY: [], PY: [] }
  for (const t of list) {
    const key = (t.country as string) || "BR"
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups as Record<Country, Teacher[]>
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

function IconButton({
  title,
  onClick,
  children,
  className = "",
  disabled,
}: {
  title: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        w-9 h-9 rounded-xl
        border transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  )
}


export default function AdminTeachersPage() {
  const [data, setData] = useState<TeachersGrouped>({ approved: [], pending: [], disabled: [] })
  const [activeTab, setActiveTab] = useState<Tab>("pending")
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Teacher | null>(null)
  const [insights, setInsights] = useState<TeacherInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  const [openCountries, setOpenCountries] = useState<Record<Country, boolean>>({
    BR: true,
    UY: true,
    PY: true,
  })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" })
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function loadInsights(teacherId: string) {
    setInsightsLoading(true)
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}/insights`, { cache: "no-store" })
      const data = await res.json()
      setInsights(data ?? null)
    } finally {
      setInsightsLoading(false)
    }
  }

  useEffect(() => {
    if (!selected?.id) return
    setInsights(null)
    loadInsights(selected.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  async function approve(id: string) {
    await fetch(`/api/admin/teachers/${id}/approve`, { method: "PATCH" })
    load()
  }

  async function disable(id: string) {
    await fetch(`/api/admin/teachers/${id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    load()
  }

  async function enable(id: string) {
    await fetch(`/api/admin/teachers/${id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    load()
  }

  const teachersRaw = data[activeTab] ?? []

  const teachers = useMemo(() => {
    const q = normalize(query)
    if (!q) return teachersRaw

    return teachersRaw.filter((t) => {
      const hay = [
        t.id,
        t.name,
        t.email,
        t.phone,
        t.country,
        t.locale,
        t.document_type,
        t.document_number,
      ]
        .map(normalize)
        .join(" | ")

      return hay.includes(q)
    })
  }, [teachersRaw, query])

  const grouped = useMemo(() => groupByCountry(teachers), [teachers])

  const counts = useMemo(
    () => ({
      pending: data.pending.length,
      approved: data.approved.length,
      disabled: data.disabled.length,
    }),
    [data]
  )

  const badgeStatus = statusBadge(activeTab)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  function toggleCountry(c: Country) {
    setOpenCountries((prev) => ({ ...prev, [c]: !prev[c] }))
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 text-white">
      {/* Header */}
      <div className="mb-6 sm:mb-8 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Professores</h1>
            <p className="text-slate-300 mt-1 text-sm sm:text-base">
              Pesquise, organize por país e veja detalhes em um pop-up.
            </p>
          </div>

          <span className={`text-xs rounded-full px-3 py-1 ${badgeStatus.cls}`}>{badgeStatus.label}</span>
        </div>

        {/* Tabs + refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              className={activeTab === "pending" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-white/10 hover:bg-white/15"}
              onClick={() => setActiveTab("pending")}
            >
              Pendentes ({counts.pending})
            </Button>

            <Button
              className={activeTab === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-white/10 hover:bg-white/15"}
              onClick={() => setActiveTab("approved")}
            >
              Aprovados ({counts.approved})
            </Button>

            <Button
              className={activeTab === "disabled" ? "bg-red-600 hover:bg-red-700" : "bg-white/10 hover:bg-white/15"}
              onClick={() => setActiveTab("disabled")}
            >
              Desativados ({counts.disabled})
            </Button>
          </div>

          <Button
            onClick={load}
            disabled={loading}
            className="sm:ml-auto bg-white/10 hover:bg-white/15 border border-white/10"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-full relative">
            <Search className="w-4 h-4 text-white/80 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar nome, email, telefone, documento ou ID..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="text-slate-400">Carregando...</p>}

      {!loading && teachers.length === 0 && (
        <p className="text-slate-400">Nenhum professor encontrado neste filtro.</p>
      )}

      {/* Groups */}
      {!loading && teachers.length > 0 && (
        <div className="space-y-10">
          {(["BR", "UY", "PY"] as Country[]).map((c) => {
            const list = grouped[c] ?? []
            const open = openCountries[c]
            if (list.length === 0) return null

            return (
              <section key={c} className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => toggleCountry(c)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="text-base sm:text-lg font-semibold">{countryLabel(c)}</span>
                    <span className="text-xs text-white/80 border border-white/10 rounded-full px-2 py-1">
                      {list.length}
                    </span>
                    {open ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                  </button>
                </div>

                {open && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {list.map((t) => {
                      const lb = localeBadge(t.locale)

                      return (
                        <Card
                          key={t.id}
                          className="bg-slate-900/10 backdrop-blur-xl border border-white/10"
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-white flex items-start sm:items-center justify-between gap-2 flex-wrap sm:flex-nowrap w-full min-w-0">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm sm:text-base font-semibold truncate">{t.name}</div>
                                <div className="text-xs text-white/50 truncate">{t.email}</div>
                              </div>

                              <span className={`shrink-0 whitespace-nowrap text-[11px] rounded-full px-2 py-1 ${lb.cls}`}>
                                {lb.label}
                              </span>
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="pt-0">
                            {/* Basic mini rows */}
                            <div className="space-y-1.5 text-xs text-white/70">
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <b className="shrink-0">Telefone</b>
                                <span className="min-w-0 flex-1 text-right truncate">{maskPhone(t.phone)}</span>
                              </div>

                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <b className="shrink-0">{docLabel(t)}</b>
                                <span className="min-w-0 flex-1 text-right truncate">{t.document_number}</span>
                              </div>

                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <b className="shrink-0">ID</b>
                                <span className="min-w-0 flex-1 text-right font-mono text-[11px] text-white/80 truncate">
                                  {t.id}
                                </span>
                              </div>
                            </div>

                            {/* Footer actions */}
                            <div className="mt-4 flex items-center justify-between gap-2">
                              <span className={`text-[11px] rounded-full px-2 py-1 ${badgeStatus.cls}`}>
                                {badgeStatus.label}
                              </span>

                              <div className="flex items-center gap-2">
                                {/* copiar ID */}
                                <IconButton title="Copiar ID" onClick={() => copy(t.id)}
                                  className="border-white/30 bg-white/10 hover:bg-white/15 text-white">
                                  <Copy className="w-4 h-4 text-white/70" />
                                </IconButton>

                                {/* infos */}
                                <IconButton title="Informações" onClick={() => setSelected(t)}
                                  className="border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-200">
                                  <Info className="w-4 h-4" />
                                </IconButton>

                                {/* editar */}
                                <Link href={`/portal/dashboard/admin/teachers/${t.id}`} title="Editar">
                                  <span className="inline-flex">
                                    <IconButton title="Editar" className="border-green-500/20 bg-green-500/10 hover:bg-green-500/15 text-green-200" >
                                      <Pencil className="w-4 h-4" />
                                    </IconButton>
                                  </span>
                                </Link>

                                {/* ações por status */}
                                {activeTab === "pending" && (
                                  <IconButton
                                    title="Aprovar"
                                    onClick={() => approve(t.id)}
                                    className="border-green-500/20 bg-green-500/10 hover:bg-green-500/15 text-green-200"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </IconButton>
                                )}

                                {activeTab !== "disabled" ? (
                                  <IconButton
                                    title="Desativar"
                                    onClick={() => disable(t.id)}
                                    className="border-red-500/20 bg-red-500/10 hover:bg-red-500/15 text-red-200"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </IconButton>
                                ) : (
                                  <IconButton
                                    title="Reativar"
                                    onClick={() => enable(t.id)}
                                    className="border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </IconButton>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Modal (responsivo) */}
      {selected && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null)
          }}
        >
          <div
            className="
              w-full max-w-2xl
              rounded-2xl border border-white/15
              bg-slate-950/80 backdrop-blur-xl
              shadow-2xl shadow-black/40
              overflow-hidden
              max-h-[85vh]
              flex flex-col
            "
          >
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold text-base sm:text-lg truncate">{selected.name}</p>
                <p className="text-white/50 text-sm truncate">{selected.email}</p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-sm overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-white/70 bg-white/10 border border-white/10 rounded-full px-3 py-1">
                  ID: {selected.id}
                </span>
                <span className="text-xs text-white/70 bg-white/10 border border-white/10 rounded-full px-3 py-1">
                  {countryLabel(selected.country)}
                </span>
                <span className={`text-xs rounded-full px-3 py-1 ${localeBadge(selected.locale).cls}`}>
                  {localeBadge(selected.locale).label}
                </span>
                <span className={`text-xs rounded-full px-3 py-1 ${badgeStatus.cls}`}>{badgeStatus.label}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Telefone</p>
                  <p className="text-white mt-1">{maskPhone(selected.phone)}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Documento</p>
                  <p className="text-white mt-1">
                    {docLabel(selected)}: {selected.document_number}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Locale</p>
                  <p className="text-white mt-1">{selected.locale}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">País</p>
                  <p className="text-white mt-1">{selected.country}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Criado em</p>
                  <p className="text-white mt-1">{formatDate((selected as any).created_at)}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 text-xs">Atualizado em</p>
                  <p className="text-white mt-1">{formatDate((selected as any).updated_at)}</p>
                </div>
              </div>

              <div className="pt-2 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-semibold text-white">{"Aulas em v\u00eddeo"}</h3>
                  <Button
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    onClick={() => loadInsights(selected.id)}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {"Atualizar"}
                  </Button>
                </div>

                {insightsLoading && <p className="text-slate-400">{"Carregando informa\u00e7\u00f5es..."}</p>}

                {!insightsLoading && insights && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-white/60 text-xs">{"Total de aulas"}</p>
                        <p className="text-white mt-1 text-lg font-semibold">
                          {insights.videoSummary?.total_videos ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-white/60 text-xs">{"Iniciadas"}</p>
                        <p className="text-white mt-1 text-lg font-semibold">
                          {insights.videoSummary?.started_videos ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-white/60 text-xs">{"Assistidas (>=70%)"}</p>
                        <p className="text-white mt-1 text-lg font-semibold">
                          {insights.videoSummary?.watched_videos ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-white/60 text-xs">{"M\u00e9dia de progresso"}</p>
                        <p className="text-white mt-1 text-lg font-semibold">
                          {Number(insights.videoSummary?.avg_progress ?? 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                        <h4 className="text-sm font-semibold text-white">{"Diário de aulas"}</h4>
                        <span className="text-xs text-white/60">
                          {(insights.lessonSummary?.class_count ?? 0)} turmas •{" "}
                          {(insights.lessonSummary?.total_logs ?? 0)} registros
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/60">{"Registros totais"}</p>
                          <p className="text-white mt-1 text-base font-semibold">
                            {insights.lessonSummary?.total_logs ?? 0}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/60">{"Turmas com aulas"}</p>
                          <p className="text-white mt-1 text-base font-semibold">
                            {insights.lessonSummary?.class_count ?? 0}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <p className="text-xs text-white/60">{"Última aula registrada"}</p>
                          <p className="text-white mt-1 text-base font-semibold">
                            {formatDate(insights.lessonSummary?.last_lesson_date)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
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
                                  <p className="text-xs text-white/60">{"Sem registros ainda."}</p>
                                )}
                              </div>
                              <span className="text-[11px] text-white/80 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-full">
                                Próxima: {item.next_lesson}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-sm">{"Nenhum diário registrado."}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <h4 className="text-sm font-semibold text-white mb-3">{"Progresso recente"}</h4>
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
                          <p className="text-slate-400 text-sm">{"Nenhum progresso registrado."}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <h4 className="text-sm font-semibold text-white mb-3">{"Logs recentes"}</h4>
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
                          <p className="text-slate-400 text-sm">{"Nenhum log recente."}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    onClick={() => copy(selected.id)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar ID
                  </Button>

                  <Link href={`/portal/dashboard/admin/teachers/${selected.id}`}>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {activeTab === "pending" && (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => approve(selected.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aprovar
                    </Button>
                  )}

                  {activeTab !== "disabled" ? (
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => disable(selected.id)}>
                      <Ban className="w-4 h-4 mr-2" />
                      Desativar
                    </Button>
                  ) : (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => enable(selected.id)}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reativar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* footer mobile quick close */}
            <div className="p-3 border-t border-white/10 sm:hidden">
              <Button className="w-full bg-white/10 hover:bg-white/15 border border-white/10" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
