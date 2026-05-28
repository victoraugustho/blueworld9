"use client"

import { useEffect, useState } from "react"
import { RefreshCcw } from "lucide-react"

type AuditType =
  | "auth"
  | "gradebook"
  | "agenda"
  | "materials"
  | "projects"
  | "blog"
  | "notifications"
  | "admin"
  | "system"
  | "other"

type AuditRelevance = "critical" | "high" | "medium" | "low"

type AuditLog = {
  id: string
  created_at: string
  actor_id?: string | null
  actor_email?: string | null
  actor_name?: string | null
  actor_role?: string | null
  session_id?: string | null
  action: string
  target_type?: string | null
  target_id?: string | null
  request_method?: string | null
  request_path?: string | null
  ip?: string | null
  user_agent?: string | null
  status?: string | null
  metadata?: any
  log_type?: AuditType
  relevance_level?: AuditRelevance
}

type AuditSummary = {
  total: number
  failed: number
  critical: number
  last24h: number
  typeCounts: Record<AuditType, number>
  relevanceCounts: Record<AuditRelevance, number>
}

const PAGE_SIZE = 50

const TYPE_OPTIONS: { value: AuditType | "all"; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "auth", label: "Autenticacao" },
  { value: "gradebook", label: "Notas" },
  { value: "agenda", label: "Agenda" },
  { value: "materials", label: "Materiais" },
  { value: "projects", label: "Projetos" },
  { value: "blog", label: "Blog" },
  { value: "notifications", label: "Notificacoes" },
  { value: "admin", label: "Admin" },
  { value: "system", label: "Sistema" },
  { value: "other", label: "Outros" },
]

const RELEVANCE_OPTIONS: { value: AuditRelevance | "all"; label: string }[] = [
  { value: "all", label: "Todas as relevancias" },
  { value: "critical", label: "Critica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
]

const DEFAULT_SUMMARY: AuditSummary = {
  total: 0,
  failed: 0,
  critical: 0,
  last24h: 0,
  typeCounts: {
    auth: 0,
    gradebook: 0,
    agenda: 0,
    materials: 0,
    projects: 0,
    blog: 0,
    notifications: 0,
    admin: 0,
    system: 0,
    other: 0,
  },
  relevanceCounts: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function getTypeLabel(type?: AuditType | null) {
  const found = TYPE_OPTIONS.find((item) => item.value === type)
  return found?.label ?? "Outros"
}

function getTypeBadgeClass(type?: AuditType | null) {
  switch (type) {
    case "auth":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40"
    case "gradebook":
      return "bg-sky-500/15 text-sky-300 border-sky-500/40"
    case "agenda":
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
    case "materials":
      return "bg-teal-500/15 text-teal-300 border-teal-500/40"
    case "projects":
      return "bg-violet-500/15 text-violet-300 border-violet-500/40"
    case "blog":
      return "bg-pink-500/15 text-pink-300 border-pink-500/40"
    case "notifications":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
    case "admin":
      return "bg-orange-500/15 text-orange-300 border-orange-500/40"
    case "system":
      return "bg-slate-500/15 text-slate-300 border-slate-500/40"
    default:
      return "bg-white/10 text-slate-200 border-white/20"
  }
}

function getRelevanceLabel(relevance?: AuditRelevance | null) {
  switch (relevance) {
    case "critical":
      return "Critica"
    case "high":
      return "Alta"
    case "medium":
      return "Media"
    case "low":
      return "Baixa"
    default:
      return "Baixa"
  }
}

function getRelevanceBadgeClass(relevance?: AuditRelevance | null) {
  switch (relevance) {
    case "critical":
      return "bg-rose-500/20 text-rose-300 border-rose-500/45"
    case "high":
      return "bg-orange-500/20 text-orange-300 border-orange-500/45"
    case "medium":
      return "bg-amber-500/20 text-amber-300 border-amber-500/45"
    default:
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/45"
  }
}

export default function AdminLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<AuditSummary>(DEFAULT_SUMMARY)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "success" | "failed">("all")
  const [typeFilter, setTypeFilter] = useState<AuditType | "all">("all")
  const [relevanceFilter, setRelevanceFilter] = useState<AuditRelevance | "all">("all")
  const [page, setPage] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(page * PAGE_SIZE))
      if (query.trim()) params.set("q", query.trim())
      if (status !== "all") params.set("status", status)
      if (typeFilter !== "all") params.set("type", typeFilter)
      if (relevanceFilter !== "all") params.set("relevance", relevanceFilter)

      const res = await fetch(`/api/admin/audit?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
      setSummary({
        ...DEFAULT_SUMMARY,
        ...(data?.summary ?? {}),
        typeCounts: {
          ...DEFAULT_SUMMARY.typeCounts,
          ...(data?.summary?.typeCounts ?? {}),
        },
        relevanceCounts: {
          ...DEFAULT_SUMMARY.relevanceCounts,
          ...(data?.summary?.relevanceCounts ?? {}),
        },
      })
    } catch {
      setItems([])
      setTotal(0)
      setSummary(DEFAULT_SUMMARY)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, typeFilter, relevanceFilter])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Auditoria</h1>
          <p className="text-slate-400 text-sm">Registro completo das acoes do sistema</p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-white/10 bg-slate-900/35 px-4 py-3">
          <div className="text-xs text-slate-400">Total</div>
          <div className="text-2xl font-semibold text-white">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/35 px-4 py-3">
          <div className="text-xs text-slate-400">Falhas</div>
          <div className="text-2xl font-semibold text-rose-300">{summary.failed}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/35 px-4 py-3">
          <div className="text-xs text-slate-400">Criticas</div>
          <div className="text-2xl font-semibold text-amber-300">{summary.critical}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/35 px-4 py-3">
          <div className="text-xs text-slate-400">Ultimas 24h</div>
          <div className="text-2xl font-semibold text-cyan-300">{summary.last24h}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por acao, email, rota ou alvo..."
          className="w-full md:max-w-xl px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-full md:w-48 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
        >
          <option className="text-black" value="all">Todos</option>
          <option className="text-black" value="success">Sucesso</option>
          <option className="text-black" value="failed">Falha</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AuditType | "all")}
          className="w-full md:w-52 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} className="text-black" value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={relevanceFilter}
          onChange={(e) => setRelevanceFilter(e.target.value as AuditRelevance | "all")}
          className="w-full md:w-52 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white"
        >
          {RELEVANCE_OPTIONS.map((option) => (
            <option key={option.value} className="text-black" value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setPage(0)
            load()
          }}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-sm"
        >
          Filtrar
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
          <div className="text-xs text-slate-400 mb-2">Resumo por tipo</div>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
              <span
                key={option.value}
                className={`text-xs px-2.5 py-1 rounded-full border ${getTypeBadgeClass(option.value as AuditType)}`}
              >
                {option.label}: {summary.typeCounts[option.value as AuditType] ?? 0}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
          <div className="text-xs text-slate-400 mb-2">Resumo por relevancia</div>
          <div className="flex flex-wrap gap-2">
            {RELEVANCE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
              <span
                key={option.value}
                className={`text-xs px-2.5 py-1 rounded-full border ${getRelevanceBadgeClass(option.value as AuditRelevance)}`}
              >
                {option.label}: {summary.relevanceCounts[option.value as AuditRelevance] ?? 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 mb-4">
        {total} registros encontrados
      </div>

      <div className="space-y-3">
        {items.map((log) => (
          <div key={log.id} className="bg-slate-900/30 border border-white/10 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-300">{formatDate(log.created_at)}</div>
                <div className="text-lg font-semibold text-white">{log.action}</div>
                <div className="text-xs text-slate-400">
                  {log.actor_name ?? log.actor_email ?? log.actor_id ?? "Sistema"}{" "}
                  {log.actor_role ? `(${log.actor_role})` : ""}
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  log.status === "failed"
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {log.status ?? "success"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full border ${getTypeBadgeClass(log.log_type)}`}>
                Tipo: {getTypeLabel(log.log_type)}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${getRelevanceBadgeClass(log.relevance_level)}`}>
                Relevancia: {getRelevanceLabel(log.relevance_level)}
              </span>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              {log.request_method ? `${log.request_method} ` : ""}
              {log.request_path ?? ""}
            </div>

            {(log.target_type || log.target_id) && (
              <div className="mt-2 text-xs text-slate-300">
                Alvo: {log.target_type ?? "-"} {log.target_id ?? ""}
              </div>
            )}

            {log.metadata && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-cyan-300">Detalhes</summary>
                <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap break-words bg-slate-900/60 border border-white/10 rounded-lg p-3">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}

        {items.length === 0 && !loading && (
          <div className="text-slate-400">Nenhum registro encontrado.</div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >
          Anterior
        </button>
        <div className="text-xs text-slate-400">
          Pagina {page + 1} de {totalPages}
        </div>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >
          Proxima
        </button>
      </div>
    </div>
  )
}
