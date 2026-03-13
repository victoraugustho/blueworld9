"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { BugReport } from "@/app/types/portal"

type BugReportRow = BugReport & {
  teacher_name?: string
  teacher_email?: string
}

function normalize(value: any) {
  return String(value ?? "").trim().toLowerCase()
}

export default function BugReportsClient() {
  const [reports, setReports] = useState<BugReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/bug-reports", { cache: "no-store" })
    if (!res.ok) {
      setReports([])
      setLoading(false)
      return
    }
    const data = await res.json()
    setReports(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return reports
    return reports.filter((r) => {
      const hay = [
        r.title,
        r.description,
        r.page_url,
        r.teacher_name,
        r.teacher_email,
        r.id,
      ]
        .map(normalize)
        .join(" ")
      return hay.includes(q)
    })
  }, [reports, query])

  return (
    <div className="p-6 text-white">
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-3xl font-bold">Relatos de bug</h1>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por titulo, descricao, professor ou URL..."
          className="max-w-md bg-slate-900/60 border border-white/10 text-white placeholder:text-white/40"
        />
        <span className="text-xs text-slate-400">
          {filtered.length} {filtered.length === 1 ? "relato" : "relatos"}
        </span>
      </div>

      {loading && <p className="text-slate-400 animate-pulse">Carregando...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-slate-400">Nenhum relato encontrado.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((r) => {
          const created = r.created_at ? new Date(r.created_at) : null
          const createdLabel = created ? created.toLocaleString("pt-BR") : "-"

          return (
            <Card key={r.id} className="bg-slate-800/20 border-slate-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white text-lg">{r.title}</CardTitle>
                <p className="text-xs text-slate-400">{createdLabel}</p>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap mb-4">{r.description}</p>

                <div className="text-sm text-slate-300 space-y-2">
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
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

