"use client"

import { useEffect, useState } from "react"
import { RefreshCcw } from "lucide-react"

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
}

const PAGE_SIZE = 50

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function AdminLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "success" | "failed">("all")
  const [page, setPage] = useState(0)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(page * PAGE_SIZE))
    if (query.trim()) params.set("q", query.trim())
    if (status !== "all") params.set("status", status)

    const res = await fetch(`/api/admin/audit?${params.toString()}`, { cache: "no-store" })
    const data = await res.json()
    setItems(data?.items ?? [])
    setTotal(data?.total ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status])

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

      <div className="flex flex-col md:flex-row gap-3 mb-6">
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
