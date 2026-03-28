"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type BlogStatus = "draft" | "review" | "scheduled" | "published" | "archived"
type BlogLanguage = "pt-BR" | "es"

type BlogPostRow = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  language: BlogLanguage
  status: BlogStatus
  author_name?: string | null
  author_email?: string | null
  author_avatar_url?: string | null
  cover_image_url?: string | null
  published_at?: string | null
  scheduled_at?: string | null
  updated_at?: string | null
}

const STATUS_ORDER: BlogStatus[] = ["draft", "review", "scheduled", "published", "archived"]
const STATUS_LABEL: Record<BlogStatus, string> = {
  draft: "Rascunho",
  review: "Revisao",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
}
const STATUS_BADGE_CLASS: Record<BlogStatus, string> = {
  draft: "bg-slate-500/20 text-slate-200 border-slate-400/40",
  review: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  scheduled: "bg-indigo-500/20 text-indigo-200 border-indigo-400/40",
  published: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  archived: "bg-rose-500/20 text-rose-200 border-rose-400/40",
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="m12 6 4 4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v7M14 10v7" />
    </svg>
  )
}

function initials(name: string) {
  const cleaned = String(name ?? "").trim()
  if (!cleaned) return "A"
  const parts = cleaned.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((item) => item.charAt(0).toUpperCase()).join("")
}

function formatDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString("pt-BR")
}

function truncate(text: string, max = 150) {
  const clean = String(text ?? "").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}...`
}

export default function BlogPostsListClient() {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<BlogPostRow[]>([])
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [language, setLanguage] = useState<BlogLanguage | "all">("all")
  const [activeStatus, setActiveStatus] = useState<BlogStatus | "all">("all")

  async function loadPosts() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("page_size", "300")
    if (query.trim()) params.set("q", query.trim())
    if (language !== "all") params.set("language", language)

    const res = await fetch(`/api/admin/blog/posts?${params.toString()}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    setPosts(Array.isArray(data?.items) ? data.items : [])
    setTotal(Number(data?.total ?? 0))
    setLoading(false)
  }

  async function deletePost(post: BlogPostRow) {
    const ok = window.confirm(`Excluir o post "${post.title}"?`)
    if (!ok) return

    setDeletingId(post.id)
    const res = await fetch(`/api/admin/blog/posts/${post.id}`, { method: "DELETE" })
    setDeletingId(null)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Nao foi possivel excluir o post.")
      return
    }

    await loadPosts()
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const counts = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        acc[post.status] += 1
        return acc
      },
      { draft: 0, review: 0, scheduled: 0, published: 0, archived: 0 } as Record<BlogStatus, number>
    )
  }, [posts])

  const filteredPosts = useMemo(() => {
    if (activeStatus === "all") return posts
    return posts.filter((post) => post.status === activeStatus)
  }, [posts, activeStatus])

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Posts do Blog</h1>
          <p className="text-sm text-slate-300 mt-1">
            Visualizacao em cards com separacao por status.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/portal/dashboard/admin/blog">
            <Button className="bg-white/10 hover:bg-white/15 border border-white/10">Voltar</Button>
          </Link>
          <Link href="/portal/dashboard/admin/blog/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">Novo Post</Button>
          </Link>
        </div>
      </div>

      <Card className="bg-slate-900/20 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              className="bg-slate-800/60 border-slate-700 text-white md:col-span-2"
              placeholder="Buscar por titulo, slug ou resumo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value as BlogLanguage | "all")}
            >
              <option value="all">Todos idiomas</option>
              <option value="pt-BR">Portugues (BR)</option>
              <option value="es">Espanol</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={loadPosts} className="bg-cyan-600 hover:bg-cyan-700" disabled={loading}>
              {loading ? "Carregando..." : "Aplicar filtros"}
            </Button>
            <span className="text-xs text-slate-400">Total: {total}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveStatus("all")}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            activeStatus === "all"
              ? "bg-cyan-600/30 border-cyan-400/60 text-cyan-100"
              : "bg-white/5 border-white/20 text-slate-200 hover:bg-white/10"
          }`}
        >
          Todos ({posts.length})
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              activeStatus === status
                ? "bg-cyan-600/30 border-cyan-400/60 text-cyan-100"
                : "bg-white/5 border-white/20 text-slate-200 hover:bg-white/10"
            }`}
          >
            {STATUS_LABEL[status]} ({counts[status]})
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-300">Carregando posts...</p>}
      {!loading && filteredPosts.length === 0 && <p className="text-slate-300">Nenhum post encontrado.</p>}

      {!loading && filteredPosts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPosts.map((post) => {
            const excerpt = truncate(post.excerpt || "Sem resumo informado para este post.", 165)
            const updatedAt = formatDate(post.updated_at)
            const scheduledAt = formatDate(post.scheduled_at)
            const publishedAt = formatDate(post.published_at)

            return (
              <article
                key={post.id}
                className="rounded-2xl border border-white/10 bg-slate-900/55 overflow-hidden flex flex-col min-h-[420px]"
              >
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="h-44 w-full bg-gradient-to-br from-slate-700 to-slate-900 border-b border-white/10 flex items-center justify-center text-sm text-slate-300">
                    Sem imagem de capa
                  </div>
                )}

                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs border rounded-full px-2 py-1 ${STATUS_BADGE_CLASS[post.status]}`}>
                      {STATUS_LABEL[post.status]}
                    </span>
                    <span className="text-[11px] text-slate-400">{post.language}</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold leading-tight line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">/{post.slug}</p>
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed">{excerpt}</p>

                  {(post.author_name || post.author_email) && (
                    <div className="flex items-center gap-2">
                      {post.author_avatar_url ? (
                        <img
                          src={post.author_avatar_url}
                          alt={post.author_name || "autor"}
                          className="h-8 w-8 rounded-full object-cover border border-white/20"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-cyan-700/60 border border-cyan-400/40 flex items-center justify-center text-xs font-semibold">
                          {initials(post.author_name || "Autor")}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 truncate">{post.author_name || "Autor nao definido"}</p>
                        {post.author_email && <p className="text-[11px] text-slate-400 truncate">{post.author_email}</p>}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 space-y-1">
                    {scheduledAt && <p>Agendado: {scheduledAt}</p>}
                    {publishedAt && <p>Publicado: {publishedAt}</p>}
                    {updatedAt && <p>Atualizado: {updatedAt}</p>}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <Link href={`/portal/dashboard/admin/blog/${post.id}`} className="text-cyan-300 text-sm hover:text-cyan-200">
                      Leia mais
                    </Link>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/portal/dashboard/admin/blog/${post.id}`}
                        title="Abrir edicao do post"
                        aria-label="Abrir edicao do post"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-500/50 bg-blue-600/20 text-blue-200 hover:bg-blue-600/35 transition"
                      >
                        <PencilIcon />
                      </Link>
                      <button
                        type="button"
                        title="Excluir post"
                        aria-label="Excluir post"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/50 bg-rose-600/20 text-rose-200 hover:bg-rose-600/35 transition disabled:opacity-60"
                        onClick={() => deletePost(post)}
                        disabled={deletingId === post.id}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
