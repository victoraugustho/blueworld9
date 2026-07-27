"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronRight, FileText, Image as ImageIcon, Layers, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Locale = "pt-BR" | "es"

type ProjectItem = {
  id: string
  title: string
  summary: string
  title_pt: string
  title_es: string
  summary_pt?: string | null
  summary_es?: string | null
  cover_image_url?: string | null
  images_count: number
  documents_count: number
  links_count: number
  category_id?: string | null
  category_title?: string | null
  category_description?: string | null
  category_cover_image_url?: string | null
  category_sort_order?: number | null
}

type ProjectCategoryView = {
  key: string
  id: string | null
  title: string
  description: string
  cover_image_url: string | null
  sort_order: number
  projects: ProjectItem[]
}

export default function TeacherProjectsClient({ locale }: { locale: Locale }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ProjectItem[]>([])
  const [query, setQuery] = useState("")
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("page_size", "120")
    if (query.trim()) params.set("q", query.trim())

    const res = await fetch(`/api/portal/projects?${params.toString()}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    setItems(Array.isArray(data?.items) ? data.items : [])
    setSelectedCategoryKey(null)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  const labels = useMemo(() => {
    if (locale === "es") {
      return {
        title: "Proyectos",
        subtitle: "Guías técnicas para apoyar clases de circuitos, programación y desarrollo de proyectos.",
        searchPlaceholder: "Buscar proyecto...",
        apply: "Aplicar",
        open: "Abrir proyecto",
        openCategory: "Abrir categoría",
        backToCategories: "Volver a categorías",
        categories: "Categorías",
        images: "Imágenes",
        documents: "Documentos",
        links: "Enlaces",
        projectCount: "proyectos",
        uncategorized: "General",
        uncategorizedDescription: "Proyectos generales con Arduino, Micro:Bit, MakeyMakey, MBlock, programación y circuitos.",
        noResults: "No hay proyectos publicados para tu perfil.",
      }
    }

    return {
      title: "Projetos",
      subtitle: "Guias técnicos para apoiar aulas de circuitos, programação e desenvolvimento de projetos.",
      searchPlaceholder: "Buscar projeto...",
      apply: "Aplicar",
      open: "Abrir projeto",
      openCategory: "Abrir categoria",
      backToCategories: "Voltar às categorias",
      categories: "Categorias",
      images: "Imagens",
      documents: "Documentos",
      links: "Links",
      projectCount: "projetos",
      uncategorized: "Geral",
      uncategorizedDescription: "Projetos gerais com Arduino, Micro:Bit, MakeyMakey, MBlock, programação e circuitos.",
      noResults: "Não há projetos publicados para o seu perfil.",
    }
  }, [locale])

  const categories = useMemo<ProjectCategoryView[]>(() => {
    const map = new Map<string, ProjectCategoryView>()

    for (const item of items) {
      const hasCategory = Boolean(item.category_id && item.category_title)
      const key = hasCategory ? String(item.category_id) : "__general"

      if (!map.has(key)) {
        map.set(key, {
          key,
          id: hasCategory ? String(item.category_id) : null,
          title: hasCategory ? String(item.category_title) : labels.uncategorized,
          description: hasCategory
            ? String(item.category_description ?? "")
            : labels.uncategorizedDescription,
          cover_image_url: hasCategory ? String(item.category_cover_image_url ?? "") || null : "/project-general-cover-v2.webp",
          sort_order: hasCategory ? Number(item.category_sort_order ?? 0) : 999999,
          projects: [],
        })
      }

      map.get(key)?.projects.push(item)
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.title.localeCompare(b.title)
    })
  }, [items, labels.uncategorized, labels.uncategorizedDescription])

  const selectedCategory = selectedCategoryKey
    ? categories.find((category) => category.key === selectedCategoryKey) ?? null
    : null
  const visibleProjects = selectedCategory ? selectedCategory.projects : []

  function renderProjectCard(item: ProjectItem) {
    return (
      <Card key={item.id} className="group relative gap-0 overflow-hidden border-white/10 bg-slate-900/35 py-0 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-900/35 to-emerald-500/10" />
        <CardContent className="relative p-0">
          <div className="relative aspect-[3/1] w-full border-b border-white/10 bg-slate-950 flex items-center justify-center overflow-hidden leading-none">
            {item.cover_image_url ? (
              <img src={item.cover_image_url} alt={item.title} className="block h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-slate-500" />
              </div>
            )}
          </div>

          <div className="p-2.5 space-y-2">
            <div className="flex items-start gap-2">
              <div className="h-9 w-9 shrink-0 rounded-lg border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-semibold text-white line-clamp-2">{item.title}</h3>
              </div>
            </div>

            <p className="text-sm text-slate-200/95 line-clamp-3">{item.summary || "-"}</p>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-slate-200">
                <ImageIcon className="w-3 h-3" />
                {labels.images}: {item.images_count}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-slate-200">
                <FileText className="w-3 h-3" />
                {labels.documents}: {item.documents_count}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-slate-200">
                <Link2 className="w-3 h-3" />
                {labels.links}: {item.links_count}
              </span>
            </div>

            <div className="pt-1 border-t border-white/10 flex justify-end">
              <Link href={`/portal/dashboard/projetos/${item.id}`}>
                <Button size="sm" className="bg-cyan-600/90 hover:bg-cyan-700 text-white h-8">
                  <span>{labels.open}</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">{labels.title}</h2>
        <p className="text-sm text-slate-300 mt-0.5">{labels.subtitle}</p>
      </div>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Input
            className="bg-slate-800/60 border-slate-700 text-white max-w-xl"
            placeholder={labels.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void load()} disabled={loading}>
            {loading ? "..." : labels.apply}
          </Button>
        </CardContent>
      </Card>

      {!selectedCategory ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-white">{labels.categories}</h3>
            <span className="text-xs text-slate-400">{categories.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setSelectedCategoryKey(category.key)}
                className="group overflow-hidden rounded-lg border border-white/10 bg-slate-900/35 text-left backdrop-blur transition hover:border-cyan-300/40 hover:bg-white/10"
              >
                <div className="relative aspect-[16/7] w-full border-b border-white/10 bg-slate-950 flex items-center justify-center overflow-hidden leading-none">
                  {category.cover_image_url ? (
                    <>
                      <img
                        src={category.cover_image_url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
                      />
                      <img
                        src={category.cover_image_url}
                        alt={category.title}
                        className="relative z-10 block h-full w-full object-contain"
                      />
                    </>
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-500" />
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white line-clamp-2">{category.title}</h3>
                      <p className="mt-1 text-sm text-slate-300 line-clamp-2">{category.description || "-"}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-cyan-200 transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                    <span className="text-xs text-slate-400">
                      {/*category.projects.length*/} {/*labels.projectCount*/}
                    </span>
                    <span className="text-xs font-medium text-cyan-200">{labels.openCategory}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-white">{selectedCategory.title}</h3>
              <p className="text-sm text-slate-300">{selectedCategory.description || "-"}</p>
            </div>
            <Button
              className="bg-white/10 hover:bg-white/15 border border-white/10"
              onClick={() => setSelectedCategoryKey(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {labels.backToCategories}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
            {visibleProjects.map((item) => renderProjectCard(item))}
          </div>
        </div>
      )}

      {!loading && items.length === 0 ? (
        <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
          <CardContent className="p-6 text-sm text-slate-300">{labels.noResults}</CardContent>
        </Card>
      ) : null}
    </div>
  )
}
