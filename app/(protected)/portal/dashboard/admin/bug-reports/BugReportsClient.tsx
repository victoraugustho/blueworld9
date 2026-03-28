"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { BugReport } from "@/app/types/portal"

type BugStatus = "pending" | "resolving" | "resolved"
type StatusFilter = "all" | BugStatus

type BugReportRow = BugReport & {
  teacher_name?: string
  teacher_email?: string
  status: BugStatus
}

const STATUS_META: Record<BugStatus, { label: string; badgeClass: string; buttonClass: string }> = {
  pending: {
    label: "Pendente",
    badgeClass: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    buttonClass: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  },
  resolving: {
    label: "Resolvendo",
    badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    buttonClass: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  },
  resolved: {
    label: "Resolvido",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    buttonClass: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  },
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizeStatus(value: unknown): BugStatus {
  if (value === "resolving") return "resolving"
  if (value === "resolved") return "resolved"
  return "pending"
}

export default function BugReportsClient() {
  const [reports, setReports] = useState<BugReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [savingById, setSavingById] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/bug-reports", { cache: "no-store" })
    if (!res.ok) {
      setReports([])
      setLoading(false)
      return
    }

    const data = await res.json().catch(() => [])
    const normalized = Array.isArray(data)
      ? data.map((item) => ({
          ...item,
          status: normalizeStatus(item?.status),
        }))
      : []

    setReports(normalized)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(id: string, status: BugStatus) {
    const current = reports.find((item) => item.id === id)
    if (!current || current.status === status) return

    setSavingById((prev) => ({ ...prev, [id]: true }))
    setReports((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))

    const res = await fetch("/api/admin/bug-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })

    if (!res.ok) {
      setReports((prev) => prev.map((item) => (item.id === id ? { ...item, status: current.status } : item)))
      alert("Nao foi possivel atualizar o status.")
    }

    setSavingById((prev) => ({ ...prev, [id]: false }))
  }

  const counts = useMemo(() => {
    return reports.reduce(
      (acc, item) => {
        acc.total += 1
        acc[item.status] += 1
        return acc
      },
      { total: 0, pending: 0, resolving: 0, resolved: 0 }
    )
  }, [reports])

  const filtered = useMemo(() => {
    const q = normalize(query)
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (!q) return true

      const hay = [r.title, r.description, r.page_url, r.teacher_name, r.teacher_email, r.id]
        .map(normalize)
        .join(" ")

      return hay.includes(q)
    })
  }, [reports, query, statusFilter])

  return (
    <div className="p-6 text-white">
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-3xl font-bold">{"Rela\u00e7\u00f5es"}</h1>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
              statusFilter === "all"
                ? "bg-white/20 text-white border-white/40"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            Todas ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
              statusFilter === "pending"
                ? STATUS_META.pending.buttonClass
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            Pendente ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolving")}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
              statusFilter === "resolving"
                ? STATUS_META.resolving.buttonClass
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            Resolvendo ({counts.resolving})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
              statusFilter === "resolved"
                ? STATUS_META.resolved.buttonClass
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            Resolvido ({counts.resolved})
          </button>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por titulo, descricao, professor ou URL..."
          className="max-w-md bg-slate-900/60 border border-white/10 text-white placeholder:text-white/40"
        />

        <span className="text-xs text-slate-400">
          {filtered.length} {filtered.length === 1 ? "rela\u00e7\u00e3o" : "rela\u00e7\u00f5es"}
        </span>
      </div>

      {loading && <p className="text-slate-400 animate-pulse">Carregando...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-slate-400">Nenhuma {"rela\u00e7\u00e3o"} encontrada.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((r) => {
          const created = r.created_at ? new Date(r.created_at) : null
          const createdLabel = created ? created.toLocaleString("pt-BR") : "-"
          const statusMeta = STATUS_META[r.status]

          return (
            <Card key={r.id} className="bg-slate-800/20 border-slate-700 backdrop-blur">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-white text-lg">{r.title}</CardTitle>
                  <span className={`text-xs rounded-full px-2.5 py-1 ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{createdLabel}</p>
              </CardHeader>

              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap mb-4">{r.description}</p>

                <div className="text-sm text-slate-300 space-y-2 mb-4">
                  <p>
                    <span className="text-slate-500">Professor:</span> {r.teacher_name || "-"}
                  </p>
                  <p>
                    <span className="text-slate-500">Email:</span> {r.teacher_email || "-"}
                  </p>
                  <p className="break-all">
                    <span className="text-slate-500">URL:</span> {r.page_url || "-"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingById[r.id]}
                    className={`border ${r.status === "pending" ? STATUS_META.pending.buttonClass : "bg-white/10 hover:bg-white/15 border-white/10 text-white/80"}`}
                    onClick={() => updateStatus(r.id, "pending")}
                  >
                    Pendente
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={savingById[r.id]}
                    className={`border ${r.status === "resolving" ? STATUS_META.resolving.buttonClass : "bg-white/10 hover:bg-white/15 border-white/10 text-white/80"}`}
                    onClick={() => updateStatus(r.id, "resolving")}
                  >
                    Resolvendo
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={savingById[r.id]}
                    className={`border ${r.status === "resolved" ? STATUS_META.resolved.buttonClass : "bg-white/10 hover:bg-white/15 border-white/10 text-white/80"}`}
                    onClick={() => updateStatus(r.id, "resolved")}
                  >
                    Resolvido
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
