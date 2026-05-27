"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Code, Cpu, FileText, Image as ImageIcon, Layers } from "lucide-react"
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
  project_type: "arduino_mblock" | "programming" | "custom"
  cover_image_url?: string | null
  images_count: number
  documents_count: number
  updated_at: string
}

const TYPE_META: Record<
  ProjectItem["project_type"],
  {
    label_pt: string
    label_es: string
    icon: typeof Cpu
    badgeClass: string
    borderClass: string
    glowClass: string
    iconClass: string
  }
> = {
  arduino_mblock: {
    label_pt: "Arduino + MBlock",
    label_es: "Arduino + MBlock",
    icon: Cpu,
    badgeClass: "bg-cyan-500/20 border-cyan-300/35 text-cyan-100",
    borderClass: "border-cyan-300/25",
    glowClass: "from-cyan-500/10 via-slate-900/35 to-blue-500/10",
    iconClass: "bg-cyan-500/20 border-cyan-300/35 text-cyan-100",
  },
  programming: {
    label_pt: "Programação",
    label_es: "Programación",
    icon: Code,
    badgeClass: "bg-emerald-500/20 border-emerald-300/35 text-emerald-100",
    borderClass: "border-emerald-300/25",
    glowClass: "from-emerald-500/10 via-slate-900/35 to-teal-500/10",
    iconClass: "bg-emerald-500/20 border-emerald-300/35 text-emerald-100",
  },
  custom: {
    label_pt: "Personalizado",
    label_es: "Personalizado",
    icon: Layers,
    badgeClass: "bg-violet-500/20 border-violet-300/35 text-violet-100",
    borderClass: "border-violet-300/25",
    glowClass: "from-violet-500/10 via-slate-900/35 to-indigo-500/10",
    iconClass: "bg-violet-500/20 border-violet-300/35 text-violet-100",
  },
}

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(locale === "es" ? "es-UY" : "pt-BR")
}

export default function TeacherProjectsClient({ locale }: { locale: Locale }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ProjectItem[]>([])
  const [query, setQuery] = useState("")

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("page_size", "120")
    params.set("locale", locale)
    if (query.trim()) params.set("q", query.trim())

    const res = await fetch(`/api/portal/projects?${params.toString()}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    setItems(Array.isArray(data?.items) ? data.items : [])
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
        updatedAt: "Actualizado en",
        open: "Abrir proyecto",
        images: "Imágenes",
        documents: "Documentos",
        shortId: "ID",
        noResults: "No hay proyectos publicados para tu perfil.",
      }
    }

    return {
      title: "Projetos",
      subtitle: "Guias técnicos para apoiar aulas de circuitos, programação e desenvolvimento de projetos.",
      searchPlaceholder: "Buscar projeto...",
      apply: "Aplicar",
      updatedAt: "Atualizado em",
      open: "Abrir projeto",
      images: "Imagens",
      documents: "Documentos",
      shortId: "ID",
      noResults: "Não há projetos publicados para o seu perfil.",
    }
  }, [locale])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{labels.title}</h2>
        <p className="text-sm text-slate-300 mt-1">{labels.subtitle}</p>
      </div>

      <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
        {items.map((item) => {
          const meta = TYPE_META[item.project_type]
          const Icon = meta.icon
          const shortId = String(item.id).slice(0, 8).toUpperCase()
          const typeLabel = locale === "es" ? meta.label_es : meta.label_pt

          return (
            <Card key={item.id} className={`group relative overflow-hidden bg-slate-900/35 backdrop-blur ${meta.borderClass}`}>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.glowClass}`} />
              <CardContent className="relative p-3 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center ${meta.iconClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}>
                        {typeLabel}
                      </span>
                      <span className="text-[11px] text-slate-400">{labels.shortId}: {shortId}</span>
                    </div>
                    <h3 className="text-base font-semibold text-white line-clamp-2">{item.title}</h3>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  {item.cover_image_url ? (
                    <img
                      src={item.cover_image_url}
                      alt={item.title}
                      className="h-24 w-24 rounded-lg border border-white/10 object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-lg border border-white/10 bg-white/5 shrink-0 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm text-slate-200/95 line-clamp-4">{item.summary || "-"}</p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-slate-200">
                        <ImageIcon className="w-3 h-3" />
                        {labels.images}: {item.images_count}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-slate-200">
                        <FileText className="w-3 h-3" />
                        {labels.documents}: {item.documents_count}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {labels.updatedAt}: {formatDate(item.updated_at, locale)}
                  </p>
                  <Link href={`/portal/dashboard/projetos/${item.id}`}>
                    <Button size="sm" className="bg-cyan-600/90 hover:bg-cyan-700 text-white h-8">
                      <span>{labels.open}</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!loading && items.length === 0 ? (
        <Card className="bg-slate-900/20 border border-white/10 backdrop-blur">
          <CardContent className="p-6 text-sm text-slate-300">{labels.noResults}</CardContent>
        </Card>
      ) : null}
    </div>
  )
}
