"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ImagePlus, Pencil, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog"

type ProjectStatus = "draft" | "published" | "archived"
type ProjectLocale = "pt-BR" | "es"
type CategoryStatus = "active" | "archived"

type ProjectRow = {
  id: string
  status: ProjectStatus
  title_pt: string
  title_es: string
  summary_pt?: string | null
  summary_es?: string | null
  cover_image_url?: string | null
  access_scope: "all" | "targeted"
  category_title?: string | null
  category_locale?: ProjectLocale | null
  images_count: number
  documents_count: number
  links_count: number
  comments_count: number
  updated_at: string
}

type CategoryRow = {
  id: string
  locale: ProjectLocale
  status: CategoryStatus
  title: string
  description?: string | null
  cover_image_url?: string | null
  sort_order: number
  projects_count: number
  updated_at: string
}

type CategoryForm = {
  locale: ProjectLocale
  status: CategoryStatus
  title: string
  description: string
  cover_image_url: string
  sort_order: string
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

const CATEGORY_STATUS_LABEL: Record<CategoryStatus, string> = {
  active: "Ativa",
  archived: "Arquivada",
}

const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  draft: "border-amber-300/35 bg-amber-500/20 text-amber-100",
  published: "border-emerald-300/35 bg-emerald-500/20 text-emerald-100",
  archived: "border-slate-300/25 bg-slate-500/20 text-slate-100",
}

const CATEGORY_STATUS_BADGE_CLASS: Record<CategoryStatus, string> = {
  active: "border-emerald-300/35 bg-emerald-500/20 text-emerald-100",
  archived: "border-slate-300/25 bg-slate-500/20 text-slate-100",
}

const EMPTY_CATEGORY_FORM: CategoryForm = {
  locale: "pt-BR",
  status: "active",
  title: "",
  description: "",
  cover_image_url: "",
  sort_order: "0",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("pt-BR")
}

export default function ProjectsAdminClient() {
  const [view, setView] = useState<"projects" | "categories">("projects")
  const [items, setItems] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ProjectStatus | "all">("all")
  const [total, setTotal] = useState(0)

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoryQuery, setCategoryQuery] = useState("")
  const [categoryStatus, setCategoryStatus] = useState<CategoryStatus | "all">("all")
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [savingCategory, setSavingCategory] = useState(false)
  const [uploadingCategoryCover, setUploadingCategoryCover] = useState(false)

  const { confirm, confirmDialog } = useConfirmDialog()

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

  async function loadCategories() {
    setCategoriesLoading(true)
    const params = new URLSearchParams()
    if (categoryQuery.trim()) params.set("q", categoryQuery.trim())
    if (categoryStatus !== "all") params.set("status", categoryStatus)

    const res = await fetch(`/api/admin/projects/categories?${params.toString()}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    setCategories(Array.isArray(data?.items) ? data.items : [])
    setCategoriesLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryStatus])

  const statusCount = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += 1
        return acc
      },
      { draft: 0, published: 0, archived: 0 } as Record<ProjectStatus, number>,
    )
  }, [items])

  function resetCategoryForm() {
    setEditingCategoryId(null)
    setCategoryForm(EMPTY_CATEGORY_FORM)
  }

  function editCategory(category: CategoryRow) {
    setEditingCategoryId(category.id)
    setCategoryForm({
      locale: category.locale,
      status: category.status,
      title: category.title,
      description: String(category.description ?? ""),
      cover_image_url: String(category.cover_image_url ?? ""),
      sort_order: String(category.sort_order ?? 0),
    })
  }

  async function uploadCategoryCover(file: File | null) {
    if (!file) return
    setUploadingCategoryCover(true)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("kind", "image")
      form.set("scope", "category")

      const res = await fetch("/api/admin/projects/assets/upload", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.file_url) {
        alert(data?.error ?? "Falha ao enviar capa da categoria.")
        return
      }
      setCategoryForm((prev) => ({ ...prev, cover_image_url: String(data.file_url) }))
    } finally {
      setUploadingCategoryCover(false)
    }
  }

  async function saveCategory() {
    const title = categoryForm.title.trim()
    if (!title) {
      alert("Preencha o título da categoria.")
      return
    }

    setSavingCategory(true)
    try {
      const payload = {
        locale: categoryForm.locale,
        status: categoryForm.status,
        title,
        description: categoryForm.description.trim() || null,
        cover_image_url: categoryForm.cover_image_url.trim() || null,
        sort_order: Number.isInteger(Number(categoryForm.sort_order)) ? Number(categoryForm.sort_order) : 0,
      }

      const url = editingCategoryId
        ? `/api/admin/projects/categories/${editingCategoryId}`
        : "/api/admin/projects/categories"
      const res = await fetch(url, {
        method: editingCategoryId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error ?? "Falha ao salvar categoria.")
        return
      }

      resetCategoryForm()
      await loadCategories()
    } finally {
      setSavingCategory(false)
    }
  }

  async function removeProject(id: string, title: string) {
    const ok = await confirm({
      title: "Arquivar projeto",
      description: `Deseja arquivar o projeto "${title}"?`,
      confirmText: "Arquivar",
      variant: "danger",
    })
    if (!ok) return
    const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao excluir projeto.")
      return
    }
    await load()
  }

  async function removeCategory(category: CategoryRow) {
    const ok = await confirm({
      title: "Arquivar categoria",
      description: `Deseja arquivar "${category.title}"? Os projetos vinculados voltarão para "Geral".`,
      confirmText: "Arquivar",
      variant: "danger",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/projects/categories/${category.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha ao arquivar categoria.")
      return
    }

    if (editingCategoryId === category.id) resetCategoryForm()
    await Promise.all([loadCategories(), load()])
  }

  return (
    <div className="p-4 md:p-6 space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Projetos (Admin)</h1>
          <p className="text-sm text-slate-300 mt-1">
            Crie e organize projetos técnicos para os professores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portal/dashboard/admin/projetos/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">Novo Projeto</Button>
          </Link>
          <Button
            className="bg-white/10 hover:bg-white/15 border border-white/10"
            onClick={() => {
              void load()
              void loadCategories()
            }}
            disabled={loading || categoriesLoading}
          >
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("projects")}
          className={`rounded-md border px-3 py-2 text-sm transition ${
            view === "projects"
              ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100"
              : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
          }`}
        >
          Projetos
        </button>
        <button
          type="button"
          onClick={() => setView("categories")}
          className={`rounded-md border px-3 py-2 text-sm transition ${
            view === "categories"
              ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100"
              : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
          }`}
        >
          Categorias
        </button>
      </div>

      {view === "projects" ? (
        <>
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
                      <th className="text-left font-semibold px-3 py-3">Categoria</th>
                      <th className="text-left font-semibold px-3 py-3">Status</th>
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
                            {item.title_pt || item.title_es}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">ID: {String(item.id).slice(0, 8).toUpperCase()}</p>
                        </td>
                        <td className="px-3 py-3 align-top text-slate-200">
                          {item.category_title ? (
                            <span>
                              {item.category_title}
                              <span className="block text-xs text-slate-400">{item.category_locale === "es" ? "ES" : "PT-BR"}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">Geral</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[item.status]}`}>
                            {STATUS_LABEL[item.status]}
                          </span>
                        </td>
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
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-300">
                          Nenhum projeto encontrado.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base text-white">
                {editingCategoryId ? "Editar categoria" : "Nova categoria"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-200">Idioma</Label>
                  <select
                    className="h-10 rounded-md bg-slate-800/60 border border-slate-700 px-3 text-white w-full"
                    value={categoryForm.locale}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, locale: event.target.value as ProjectLocale }))}
                  >
                    <option className="bg-slate-800 text-white" value="pt-BR">Português</option>
                    <option className="bg-slate-800 text-white" value="es">Espanhol</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-200">Status</Label>
                  <select
                    className="h-10 rounded-md bg-slate-800/60 border border-slate-700 px-3 text-white w-full"
                    value={categoryForm.status}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, status: event.target.value as CategoryStatus }))}
                  >
                    <option className="bg-slate-800 text-white" value="active">Ativa</option>
                    <option className="bg-slate-800 text-white" value="archived">Arquivada</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-slate-200">Título</Label>
                  <Input
                    className="bg-slate-800/60 border-slate-700 text-white"
                    value={categoryForm.title}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Ex: Arduino e Sensores"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-200">Descrição</Label>
                  <Textarea
                    className="bg-slate-800/60 border-slate-700 text-white min-h-[110px]"
                    value={categoryForm.description}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Descreva o tipo de projeto que entra nessa categoria."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Capa</Label>
                  <input
                    id="project-category-cover-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingCategoryCover}
                    onChange={(event) => void uploadCategoryCover(event.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor="project-category-cover-upload"
                    className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-cyan-300/40 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {uploadingCategoryCover ? "Enviando..." : "Enviar capa"}
                  </label>
                  <p className="text-xs text-slate-400">Recomendado: 1600 x 900 px.</p>
                  {categoryForm.cover_image_url ? (
                    <img
                      src={categoryForm.cover_image_url}
                      alt="Capa da categoria"
                      className="aspect-video w-full rounded-md border border-white/10 object-contain bg-slate-950/60"
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-200">Ordem</Label>
                  <Input
                    type="number"
                    className="h-10 w-32 bg-slate-800/60 border-slate-700 text-white"
                    value={categoryForm.sort_order}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                  />
                </div>
                <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void saveCategory()} disabled={savingCategory}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingCategory ? "Salvando..." : editingCategoryId ? "Salvar edição" : "Criar categoria"}
                </Button>
                {editingCategoryId ? (
                  <Button className="bg-white/10 hover:bg-white/15 border border-white/10" onClick={resetCategoryForm}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base text-white">Categorias cadastradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  className="bg-slate-800/60 border-slate-700 text-white md:col-span-2"
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  placeholder="Buscar categoria..."
                />
                <select
                  className="rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
                  value={categoryStatus}
                  onChange={(event) => setCategoryStatus(event.target.value as CategoryStatus | "all")}
                >
                  <option className="bg-slate-800 text-white" value="all">Todos os status</option>
                  <option className="bg-slate-800 text-white" value="active">Ativas</option>
                  <option className="bg-slate-800 text-white" value="archived">Arquivadas</option>
                </select>
                <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void loadCategories()} disabled={categoriesLoading}>
                  {categoriesLoading ? "Carregando..." : "Aplicar"}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-200">
                      <th className="text-left font-semibold px-4 py-3">Categoria</th>
                      <th className="text-left font-semibold px-3 py-3">Idioma</th>
                      <th className="text-left font-semibold px-3 py-3">Status</th>
                      <th className="text-left font-semibold px-3 py-3">Projetos</th>
                      <th className="text-left font-semibold px-3 py-3">Ordem</th>
                      <th className="text-left font-semibold px-3 py-3">Atualizada</th>
                      <th className="text-left font-semibold px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-16 shrink-0 rounded-md border border-white/10 bg-slate-950/60 overflow-hidden flex items-center justify-center">
                              {category.cover_image_url ? (
                                <img src={category.cover_image_url} alt={category.title} className="h-full w-full object-contain" />
                              ) : (
                                <ImagePlus className="h-5 w-5 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white line-clamp-1">{category.title}</p>
                              <p className="text-xs text-slate-400 line-clamp-1">{category.description || "-"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-slate-200">{category.locale === "es" ? "ES" : "PT-BR"}</td>
                        <td className="px-3 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${CATEGORY_STATUS_BADGE_CLASS[category.status]}`}>
                            {CATEGORY_STATUS_LABEL[category.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-slate-200">{category.projects_count}</td>
                        <td className="px-3 py-3 align-top text-slate-200">{category.sort_order}</td>
                        <td className="px-3 py-3 align-top text-slate-300 whitespace-nowrap">{formatDate(category.updated_at)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => editCategory(category)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => void removeCategory(category)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!categoriesLoading && categories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-300">
                          Nenhuma categoria encontrada.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {confirmDialog}
    </div>
  )
}
