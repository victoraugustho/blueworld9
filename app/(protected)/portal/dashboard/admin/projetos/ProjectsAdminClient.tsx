"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type ProjectStatus = "draft" | "published" | "archived"
type ProjectType = "arduino_mblock" | "programming" | "custom"

type ProjectRow = {
  id: string
  locale?: "pt-BR" | "es" | null
  project_type: ProjectType
  status: ProjectStatus
  title_pt: string
  title_es: string
  summary_pt?: string | null
  summary_es?: string | null
  cover_image_url?: string | null
  access_scope: "all" | "targeted"
  images_count: number
  documents_count: number
  links_count: number
  comments_count: number
  updated_at: string
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  draft: "border-amber-300/35 bg-amber-500/20 text-amber-100",
  published: "border-emerald-300/35 bg-emerald-500/20 text-emerald-100",
  archived: "border-slate-300/25 bg-slate-500/20 text-slate-100",
}

const TYPE_LABEL: Record<ProjectType, string> = {
  arduino_mblock: "Arduino + MBlock",
  programming: "Programação",
  custom: "Personalizado",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

export default function ProjectsAdminClient() {
  const [items, setItems] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ProjectStatus | "all">("all")
  const [total, setTotal] = useState(0)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("page_size", "120")
    if (query.trim()) params.set("q", query.trim())
    if (status !== "all") params.set("status", status)

    const res = await fetch(`/api/admin/projects?${params.toString()}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    setItems(Array.isArray(data?.items) ? data.items : [])
    setTotal(Number(data?.total ?? 0))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const statusCount = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += 1
        return acc
      },
      { draft: 0, published: 0, archived: 0 } as Record<ProjectStatus, number>,
    )
  }, [items])

  async function removeProject(id: string, title: string) {
    if (!window.confirm(`Deseja arquivar o projeto "${title}"?`)) return
    const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao excluir projeto.")
      return
    }
    await load()
  }

  return (
    <div className="p-4 md:p-6 space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Projetos (Admin)</h1>
          <p className="text-sm text-slate-300 mt-1">
            Crie e organize projetos técnicos para os professores, com versões em português e espanhol.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portal/dashboard/admin/projetos/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">Novo Projeto</Button>
          </Link>
          <Button
            className="bg-white/10 hover:bg-white/15 border border-white/10"
            onClick={() => void load()}
            disabled={loading}
          >
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              className="bg-slate-800/60 border-slate-700 text-white md:col-span-2"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título..."
            />
            <select
              className="rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus | "all")}
            >
              <option className="bg-slate-800 text-white" value="all">Todos os status</option>
              <option className="bg-slate-800 text-white" value="draft">Rascunho</option>
              <option className="bg-slate-800 text-white" value="published">Publicado</option>
              <option className="bg-slate-800 text-white" value="archived">Arquivado</option>
            </select>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void load()} disabled={loading}>
              {loading ? "Carregando..." : "Aplicar"}
            </Button>
          </div>
          <p className="text-xs text-slate-400">Total: {total}</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Resumo por status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((key) => (
            <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-xs text-slate-300">{STATUS_LABEL[key]}</p>
              <p className="text-xl font-semibold text-white">{statusCount[key]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base text-white">Lista de projetos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-200">
                  <th className="text-left font-semibold px-4 py-3">Projeto</th>
                  <th className="text-left font-semibold px-3 py-3">Status</th>
                  <th className="text-left font-semibold px-3 py-3">Idioma</th>
                  <th className="text-left font-semibold px-3 py-3">Tipo</th>
                  <th className="text-left font-semibold px-3 py-3">Acesso</th>
                  <th className="text-left font-semibold px-3 py-3">Imgs</th>
                  <th className="text-left font-semibold px-3 py-3">Docs</th>
                  <th className="text-left font-semibold px-3 py-3">Links</th>
                  <th className="text-left font-semibold px-3 py-3">Comentários</th>
                  <th className="text-left font-semibold px-3 py-3">Atualizado</th>
                  <th className="text-left font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <p className="text-white font-semibold line-clamp-1">
                        {(item.locale === "es" ? item.title_es : item.title_pt) || item.title_pt || item.title_es}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">ID: {String(item.id).slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex rounded-full border border-cyan-300/30 px-2 py-1 text-xs bg-cyan-500/10 text-cyan-100">
                        {item.locale === "es" ? "ES" : "PT-BR"}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-200">{TYPE_LABEL[item.project_type]}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{item.access_scope === "all" ? "Todos" : "Segmentado"}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{item.images_count}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{item.documents_count}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{item.links_count}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{item.comments_count}</td>
                    <td className="px-3 py-3 align-top text-slate-300 whitespace-nowrap">{formatDate(item.updated_at)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <Link href={`/portal/dashboard/admin/projetos/${item.id}`}>
                          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700">Editar</Button>
                        </Link>
                        <Button
                          size="sm"
                          className="bg-rose-600 hover:bg-rose-700"
                          onClick={() => void removeProject(item.id, item.title_pt)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-300">
                      Nenhum projeto encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
