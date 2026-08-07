"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog"
import { ChevronDown, ChevronUp, Pencil, Trash } from "lucide-react"
import type { Material } from "@/app/types/portal"
import AdminTurmasPage from "../turmas/page"

type Lang = Material["language"]
type MaterialType = Material["file_type"]

type MaterialView = Material & {
  yearKey: string
  yearLabel: string
  yearCls: string
}

function languageLabel(lang: Lang) {
  return lang === "pt-BR" ? "Português (BR)" : "Espanhol"
}

function languageBadge(lang: Lang) {
  return lang === "pt-BR"
    ? { label: "Português (BR)", cls: "bg-emerald-500/15 text-emerald-300" }
    : { label: "Espanhol", cls: "bg-amber-500/15 text-amber-300" }
}

function typeLabel(type: MaterialType) {
  return type === "video" ? "Vídeos" : "Materiais (Documento)"
}

function typeBadge(type: MaterialType) {
  return type === "video"
    ? { label: "Vídeo", cls: "bg-blue-500/15 text-blue-300" }
    : { label: "Documento", cls: "bg-indigo-500/15 text-indigo-300" }
}

function accessBadge(material: MaterialView) {
  const ids = Array.isArray(material.teacher_ids) ? material.teacher_ids : []
  if (material.access_scope === "specific") {
    const label = ids.length === 1 ? "1 professor selecionado" : `${ids.length} professores selecionados`
    return {
      label,
      cls: "bg-amber-500/15 text-amber-300",
    }
  }

  return {
    label: "Todos os professores",
    cls: "bg-emerald-500/15 text-emerald-300",
  }
}

function yearInfo(value: any) {
  if (typeof value === "number") {
    if (value >= 103 && value <= 105) {
      const age = value - 100
      return {
        key: `age-${age}`,
        label: `${age} anos`,
        cls: "bg-purple-500/15 text-purple-300",
      }
    }
    if (value >= 1 && value <= 9) {
      return {
        key: `grade-${value}`,
        label: `Ano ${value}`,
        cls: "bg-purple-500/15 text-purple-300",
      }
    }
    if (value >= 201 && value <= 203) {
      const year = value - 200
      return {
        key: `hs-${year}`,
        label: `Ensino Médio ${year}`,
        cls: "bg-purple-500/15 text-purple-300",
      }
    }
  }

  return {
    key: "none",
    label: "Materiais complementares",
    cls: "bg-slate-500/15 text-slate-300",
  }
}

function yearLabelFromKey(key: string) {
  if (key.startsWith("age-")) return `${key.slice(4)} anos`
  if (key.startsWith("grade-")) return `Ano ${key.slice(6)}`
  if (key.startsWith("hs-")) return `Ensino Médio ${key.slice(3)}`
  return "Materiais complementares"
}

function normalizeText(value: any) {
  return String(value ?? "").trim().toLowerCase()
}

function groupByCategory(list: MaterialView[]) {
  const map: Record<string, MaterialView[]> = {}
  for (const m of list) {
    const key = m.category_name || "Sem categoria"
    if (!map[key]) map[key] = []
    map[key].push(m)
  }
  return map
}

function MaterialsPanel() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [filterLang, setFilterLang] = useState<Lang | "all">("all")
  const [filterType, setFilterType] = useState<MaterialType | "all">("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const { confirm, confirmDialog } = useConfirmDialog()

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/materials", { cache: "no-store" })
    const data = await res.json()
    setMaterials(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function deleteMaterial(id: string) {
    const ok = await confirm({
      title: "Excluir material",
      description: "Tem certeza que deseja excluir este material?",
      confirmText: "Excluir",
      variant: "danger",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/materials/${id}`, { method: "DELETE" })
    if (res.ok) load()
    else alert("Erro ao excluir material")
  }

  function isCategoryOpen(key: string) {
    return openCategories[key] !== false
  }

  function toggleCategory(key: string) {
    setOpenCategories((prev) => ({ ...prev, [key]: !(prev[key] !== false) }))
  }

  const normalized = useMemo<MaterialView[]>(
    () =>
      materials.map((m) => {
        const y = yearInfo(m.student_year)
        return {
          ...m,
          language: m.language === "es" ? "es" : "pt-BR",
          file_type: m.file_type === "video" ? "video" : "document",
          access_scope: m.access_scope === "specific" ? "specific" : "all",
          teacher_ids: Array.isArray(m.teacher_ids) ? m.teacher_ids : [],
          teacher_names: Array.isArray(m.teacher_names) ? m.teacher_names : [],
          yearKey: y.key,
          yearLabel: y.label,
          yearCls: y.cls,
        }
      }),
    [materials]
  )

  const filteredByLangType = useMemo(() => {
    return normalized.filter((m) => {
      if (filterLang !== "all" && m.language !== filterLang) return false
      if (filterType !== "all" && m.file_type !== filterType) return false
      return true
    })
  }, [normalized, filterLang, filterType])

  const yearOrder = [
    "age-3",
    "age-4",
    "age-5",
    "grade-1",
    "grade-2",
    "grade-3",
    "grade-4",
    "grade-5",
    "grade-6",
    "grade-7",
    "grade-8",
    "grade-9",
    "hs-1",
    "hs-2",
    "hs-3",
    "none",
  ]

  const yearOptions = useMemo(() => {
    const present = new Set(filteredByLangType.map((m) => m.yearKey))
    return yearOrder.filter((key) => present.has(key)).map((key) => ({
      key,
      label: yearLabelFromKey(key),
    }))
  }, [filteredByLangType])

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    return filteredByLangType.filter((m) => {
      if (filterYear !== "all" && m.yearKey !== filterYear) return false
      if (!q) return true
      const hay = [
        m.title,
        m.description,
        m.category_name,
        m.file_url,
        m.id,
        ...(m.teacher_names ?? []),
        m.access_scope === "specific" ? "específico selecionado" : "todos professores",
      ]
        .map(normalizeText)
        .join(" ")
      return hay.includes(q)
    })
  }, [filteredByLangType, filterYear, query])

  const grouped = useMemo(() => groupByCategory(filtered), [filtered])
  const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

  return (
    <div className="p-6 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciar Materiais</h1>

        <div className="flex items-center gap-2">
          <Link href="/portal/dashboard/admin/materials/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">Novo Material</Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-full sm:max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por título, categoria, turma, descrição, URL ou professor..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <span className="text-xs text-slate-400">
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-400 w-full">Idioma</span>
          {(["all", "pt-BR", "es"] as const).map((lang) => {
            const active = filterLang === lang
            const label = lang === "all" ? "Todos" : languageLabel(lang)
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setFilterLang(lang)}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
                  active
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-400 w-full">Tipo</span>
          {(["all", "document", "video"] as const).map((type) => {
            const active = filterType === type
            const label = type === "all" ? "Todos" : typeLabel(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
                  active
                    ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
                    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-400 w-full">Turma (Ano)</span>
          <button
            type="button"
            onClick={() => setFilterYear("all")}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
              filterYear === "all"
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            Todos
          </button>
          {yearOptions.map((opt) => {
            const active = filterYear === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilterYear(opt.key)}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
                  active
                    ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading && <p className="text-slate-400 animate-pulse">Carregando...</p>}

      {!loading && filtered.length === 0 && <p className="text-slate-400">Nenhum material encontrado.</p>}

      {!loading &&
        categories.map((categoria) => {
          const list = grouped[categoria] ?? []
          if (list.length === 0) return null
          const isOpen = isCategoryOpen(categoria)

          return (
            <section key={categoria} className="mb-10">
              <button
                type="button"
                onClick={() => toggleCategory(categoria)}
                className="flex items-center gap-2 mb-4 text-left"
                aria-expanded={isOpen}
              >
                <h2 className="text-2xl font-semibold text-purple-300">{categoria}</h2>
                <span className="text-xs text-slate-400">{list.length} itens</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-300" />
                )}
              </button>

              {isOpen && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur">
                  <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-4 py-3 text-[11px] uppercase tracking-wide text-slate-300 border-b border-white/10 bg-white/[0.04]">
                    <span>Material</span>
                    <span>Etiquetas</span>
                    <span>Acesso</span>
                    <span className="text-right">Ações</span>
                  </div>
                  {list.map((m) => {
                    const badge = languageBadge(m.language)
                    const tBadge = typeBadge(m.file_type)
                    const aBadge = accessBadge(m)

                    return (
                      <div
                        key={m.id}
                        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-4 py-4 border-b border-white/10 last:border-b-0 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-semibold text-white truncate">{m.title}</p>
                          <p className="text-xs text-slate-300 line-clamp-2">{m.description}</p>
                          <p className="text-[11px] text-slate-400 mt-1 truncate">{m.file_url}</p>
                        </div>

                        <div className="flex flex-wrap items-start gap-2">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs ${tBadge.cls}`}>
                            {tBadge.label}
                          </span>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs ${m.yearCls}`}>
                            {m.yearLabel}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs ${aBadge.cls}`}>
                            {aBadge.label}
                          </span>
                          {m.access_scope === "specific" && (
                            <p className="text-[11px] text-slate-400">
                              {(m.teacher_names ?? []).length > 0
                                ? `Professores: ${(m.teacher_names ?? []).join(", ")}`
                                : "Nenhum professor listado."}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 lg:justify-end">
                          <Link href={`/portal/dashboard/admin/materials/edit/${m.id}`}>
                            <Button
                              size="sm"
                              className="h-9 w-9 p-0 bg-blue-600 hover:bg-blue-700"
                              aria-label={`Editar ${m.title}`}
                              title="Editar material"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            className="h-9 w-9 p-0 bg-red-600 hover:bg-red-700"
                            onClick={() => deleteMaterial(m.id)}
                            aria-label={`Excluir ${m.title}`}
                            title="Excluir material"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      {confirmDialog}
    </div>
  )
}

type AdminMaterialsSection = "materials" | "turmas"

export default function AdminMaterialsPage() {
  const [section, setSection] = useState<AdminMaterialsSection>("materials")

  useEffect(() => {
    const syncSectionFromUrl = () => {
      const selected = new URLSearchParams(window.location.search).get("section")
      setSection(selected === "turmas" ? "turmas" : "materials")
    }

    syncSectionFromUrl()
    window.addEventListener("popstate", syncSectionFromUrl)
    return () => window.removeEventListener("popstate", syncSectionFromUrl)
  }, [])

  function selectSection(next: AdminMaterialsSection) {
    setSection(next)
    const url = new URL(window.location.href)
    if (next === "turmas") url.searchParams.set("section", "turmas")
    else url.searchParams.delete("section")
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }

  return (
    <div className="space-y-4">
      <div className="px-6 pt-6">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1">
          <button
            type="button"
            onClick={() => selectSection("materials")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              section === "materials"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            Materiais
          </button>
          <button
            type="button"
            onClick={() => selectSection("turmas")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              section === "turmas"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            Categorias/Turmas
          </button>
        </div>
      </div>

      {section === "materials" ? <MaterialsPanel /> : <AdminTurmasPage />}
    </div>
  )
}
