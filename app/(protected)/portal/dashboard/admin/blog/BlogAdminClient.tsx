"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog"

type BlogStatus = "draft" | "review" | "scheduled" | "published" | "archived"
type BlogLanguage = "pt-BR" | "es"

type BlogPostRow = {
  id: string
  status: BlogStatus
  language: BlogLanguage
}

type BlogCategory = {
  id: number
  name: string
  slug: string
  description?: string | null
  post_count?: number
}

type BlogTag = {
  id: number
  name: string
  slug: string
  post_count?: number
}

const STATUS_LABEL: Record<BlogStatus, string> = {
  draft: "Rascunho",
  review: "Revisao",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
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

export default function BlogAdminClient() {
  const [posts, setPosts] = useState<BlogPostRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [tags, setTags] = useState<BlogTag[]>([])

  const [query, setQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<BlogStatus | "all">("all")
  const [filterLanguage, setFilterLanguage] = useState<BlogLanguage | "all">("all")

  const [categoryEditId, setCategoryEditId] = useState<number | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [categorySlug, setCategorySlug] = useState("")
  const [categoryDescription, setCategoryDescription] = useState("")
  const [categorySaving, setCategorySaving] = useState(false)

  const [tagEditId, setTagEditId] = useState<number | null>(null)
  const [tagName, setTagName] = useState("")
  const [tagSlug, setTagSlug] = useState("")
  const [tagSaving, setTagSaving] = useState(false)
  const { confirm, confirmDialog } = useConfirmDialog()

  async function loadMeta() {
    const [categoriesRes, tagsRes] = await Promise.all([
      fetch("/api/admin/blog/categories", { cache: "no-store" }),
      fetch("/api/admin/blog/tags", { cache: "no-store" }),
    ])

    const categoriesData = await categoriesRes.json().catch(() => [])
    const tagsData = await tagsRes.json().catch(() => [])

    setCategories(Array.isArray(categoriesData) ? categoriesData : [])
    setTags(Array.isArray(tagsData) ? tagsData : [])
  }

  async function loadPosts() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("page_size", "120")
    if (query.trim()) params.set("q", query.trim())
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterLanguage !== "all") params.set("language", filterLanguage)

    const res = await fetch(`/api/admin/blog/posts?${params.toString()}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    setPosts(Array.isArray(data?.items) ? data.items : [])
    setTotal(Number(data?.total ?? 0))
    setLoading(false)
  }

  useEffect(() => {
    loadMeta()
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterLanguage])

  function startCategoryEdit(item: BlogCategory) {
    setCategoryEditId(item.id)
    setCategoryName(item.name ?? "")
    setCategorySlug(item.slug ?? "")
    setCategoryDescription(item.description ?? "")
  }

  function resetCategoryForm() {
    setCategoryEditId(null)
    setCategoryName("")
    setCategorySlug("")
    setCategoryDescription("")
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = categoryName.trim()
    if (!name) {
      alert("Informe o nome da categoria.")
      return
    }

    setCategorySaving(true)
    const isEdit = Number.isInteger(categoryEditId) && (categoryEditId ?? 0) > 0
    const url = isEdit ? `/api/admin/blog/categories/${categoryEditId}` : "/api/admin/blog/categories"
    const method = isEdit ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: categorySlug.trim() || undefined,
        description: categoryDescription.trim() || null,
      }),
    })
    setCategorySaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao salvar categoria.")
      return
    }

    resetCategoryForm()
    await loadMeta()
  }

  async function deleteCategory(item: BlogCategory) {
    const ok = await confirm({
      title: "Excluir categoria",
      description: `Excluir categoria "${item.name}"? Essa ação remove os vínculos dela nos posts.`,
      confirmText: "Excluir",
      variant: "danger",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/blog/categories/${item.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao excluir categoria.")
      return
    }

    if (categoryEditId === item.id) resetCategoryForm()
    await loadMeta()
  }

  function startTagEdit(item: BlogTag) {
    setTagEditId(item.id)
    setTagName(item.name ?? "")
    setTagSlug(item.slug ?? "")
  }

  function resetTagForm() {
    setTagEditId(null)
    setTagName("")
    setTagSlug("")
  }

  async function submitTag(e: React.FormEvent) {
    e.preventDefault()
    const name = tagName.trim()
    if (!name) {
      alert("Informe o nome da tag.")
      return
    }

    setTagSaving(true)
    const isEdit = Number.isInteger(tagEditId) && (tagEditId ?? 0) > 0
    const url = isEdit ? `/api/admin/blog/tags/${tagEditId}` : "/api/admin/blog/tags"
    const method = isEdit ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: tagSlug.trim() || undefined,
      }),
    })
    setTagSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao salvar tag.")
      return
    }

    resetTagForm()
    await loadMeta()
  }

  async function deleteTag(item: BlogTag) {
    const ok = await confirm({
      title: "Excluir tag",
      description: `Excluir tag "${item.name}"? Essa ação remove os vínculos dela nos posts.`,
      confirmText: "Excluir",
      variant: "danger",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/blog/tags/${item.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao excluir tag.")
      return
    }

    if (tagEditId === item.id) resetTagForm()
    await loadMeta()
  }

  const statusCount = useMemo(() => {
    return posts.reduce(
      (acc, item) => {
        acc[item.status] += 1
        return acc
      },
      { draft: 0, review: 0, scheduled: 0, published: 0, archived: 0 } as Record<BlogStatus, number>
    )
  }, [posts])

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Blog (Admin)</h1>
          <p className="text-slate-300 text-sm mt-1">
            Gestao de posts, imagens, categorias e tags para consumo no site.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/portal/dashboard/admin/blog/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">Novo Post (Editor de Blocos)</Button>
          </Link>
          <Link href="/portal/dashboard/admin/blog/posts">
            <Button className="bg-indigo-600 hover:bg-indigo-700">Visualizar Posts</Button>
          </Link>
          <Button
            onClick={async () => {
              await Promise.all([loadMeta(), loadPosts()])
            }}
            className="bg-white/10 hover:bg-white/15 border border-white/10"
            disabled={loading}
          >
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white text-base">Filtros de Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              className="bg-slate-800/60 border-slate-700 text-white md:col-span-2"
              placeholder="Buscar por titulo, slug ou resumo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as BlogStatus | "all")}
            >
              <option value="all">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="review">Revisao</option>
              <option value="scheduled">Agendado</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
            <select
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value as BlogLanguage | "all")}
            >
              <option value="all">Todos idiomas</option>
              <option value="pt-BR">Portugues (BR)</option>
              <option value="es">Espanol</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={loadPosts} className="bg-cyan-600 hover:bg-cyan-700" disabled={loading}>
              {loading ? "Carregando..." : "Aplicar filtros"}
            </Button>
            <span className="text-xs text-slate-400">
              Total: {total}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white text-base">Status dos Posts</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {(Object.keys(STATUS_LABEL) as BlogStatus[]).map((statusKey) => (
            <div key={statusKey} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-xs text-slate-300">{STATUS_LABEL[statusKey]}</p>
              <p className="text-xl font-semibold text-white">{statusCount[statusKey]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div id="taxonomias" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-slate-900/20 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitCategory} className="space-y-3">
              <div>
                <Label className="text-white">Nome</Label>
                <Input
                  className="mt-1 bg-slate-800/60 border-slate-700 text-white"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-white">Slug (opcional)</Label>
                <Input
                  className="mt-1 bg-slate-800/60 border-slate-700 text-white"
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  placeholder="gerado automaticamente"
                />
              </div>
              <div>
                <Label className="text-white">Descrição</Label>
                <Textarea
                  className="mt-1 bg-slate-800/60 border-slate-700 text-white"
                  rows={2}
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={categorySaving}>
                  {categorySaving ? "Salvando..." : categoryEditId ? "Atualizar categoria" : "Criar categoria"}
                </Button>
                {categoryEditId && (
                  <Button
                    type="button"
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    onClick={resetCategoryForm}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 backdrop-blur">
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">/{item.slug}</p>
                    <p className="text-xs text-slate-400">Posts: {Number(item.post_count ?? 0)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      title="Editar categoria"
                      aria-label="Editar categoria"
                      className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                      onClick={() => startCategoryEdit(item)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      size="sm"
                      title="Excluir categoria"
                      aria-label="Excluir categoria"
                      className="h-8 w-8 p-0 bg-rose-600 hover:bg-rose-700"
                      onClick={() => deleteCategory(item)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-slate-400">Nenhuma categoria cadastrada.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/20 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitTag} className="space-y-3">
              <div>
                <Label className="text-white">Nome</Label>
                <Input
                  className="mt-1 bg-slate-800/60 border-slate-700 text-white"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-white">Slug (opcional)</Label>
                <Input
                  className="mt-1 bg-slate-800/60 border-slate-700 text-white"
                  value={tagSlug}
                  onChange={(e) => setTagSlug(e.target.value)}
                  placeholder="gerado automaticamente"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={tagSaving}>
                  {tagSaving ? "Salvando..." : tagEditId ? "Atualizar tag" : "Criar tag"}
                </Button>
                {tagEditId && (
                  <Button
                    type="button"
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    onClick={resetTagForm}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 backdrop-blur">
              {tags.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">/{item.slug}</p>
                    <p className="text-xs text-slate-400">Posts: {Number(item.post_count ?? 0)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      title="Editar tag"
                      aria-label="Editar tag"
                      className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                      onClick={() => startTagEdit(item)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      size="sm"
                      title="Excluir tag"
                      aria-label="Excluir tag"
                      className="h-8 w-8 p-0 bg-rose-600 hover:bg-rose-700"
                      onClick={() => deleteTag(item)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>
              ))}
              {tags.length === 0 && <p className="text-sm text-slate-400">Nenhuma tag cadastrada.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      {confirmDialog}
    </div>
  )
}
