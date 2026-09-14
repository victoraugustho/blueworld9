"use client"

import { useEffect, useMemo, useState } from "react"
import type {
  TeacherContentArea,
  TeacherContentPermissions,
  TeacherContentScope,
  TeacherPortalPermissions,
} from "@/app/types/portal"
import { BookOpen, FileText, FolderKanban, Search } from "lucide-react"

type ContentOption = {
  id: string
  title: string
  category_id?: string | null
  category_title?: string | null
  locale?: string | null
  student_year?: number | null
}

type PermissionOptions = {
  categories: ContentOption[]
  aulas: ContentOption[]
  materiais: ContentOption[]
  project_categories: ContentOption[]
  projetos: ContentOption[]
}

const EMPTY_OPTIONS: PermissionOptions = {
  categories: [],
  aulas: [],
  materiais: [],
  project_categories: [],
  projetos: [],
}

const AREA_META = {
  aulas: {
    title: "Videoaulas permitidas",
    description: "Escolha turmas/categorias completas ou videoaulas individuais.",
    icon: BookOpen,
  },
  materiais: {
    title: "Materiais permitidos",
    description: "Escolha categorias completas ou documentos individuais.",
    icon: FileText,
  },
  projetos: {
    title: "Projetos permitidos",
    description: "Escolha categorias de projetos ou projetos publicados individualmente.",
    icon: FolderKanban,
  },
} satisfies Record<TeacherContentArea, {
  title: string
  description: string
  icon: typeof BookOpen
}>

export const DEFAULT_CONTENT_PERMISSIONS: TeacherContentPermissions = {
  aulas: { mode: "inherit", category_ids: [], item_ids: [] },
  materiais: { mode: "inherit", category_ids: [], item_ids: [] },
  projetos: { mode: "inherit", category_ids: [], item_ids: [] },
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR")
}

export function TeacherContentPermissionsEditor({
  value,
  onChange,
  portalPermissions,
  disabled = false,
}: {
  value: TeacherContentPermissions
  onChange: (value: TeacherContentPermissions) => void
  portalPermissions?: TeacherPortalPermissions
  disabled?: boolean
}) {
  const [options, setOptions] = useState<PermissionOptions>(EMPTY_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [queries, setQueries] = useState<Record<TeacherContentArea, string>>({
    aulas: "",
    materiais: "",
    projetos: "",
  })

  useEffect(() => {
    let active = true
    async function loadOptions() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch("/api/admin/teachers/permission-options", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.error ?? "Não foi possível carregar os conteúdos.")
        if (!active) return
        setOptions({
          categories: Array.isArray(data.categories) ? data.categories : [],
          aulas: Array.isArray(data.aulas) ? data.aulas : [],
          materiais: Array.isArray(data.materiais) ? data.materiais : [],
          project_categories: Array.isArray(data.project_categories) ? data.project_categories : [],
          projetos: Array.isArray(data.projetos) ? data.projetos : [],
        })
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os conteúdos.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadOptions()
    return () => {
      active = false
    }
  }, [])

  function updateScope(area: TeacherContentArea, patch: Partial<TeacherContentScope>) {
    onChange({
      ...value,
      [area]: {
        ...value[area],
        ...patch,
      },
    })
  }

  function toggleId(area: TeacherContentArea, field: "category_ids" | "item_ids", id: string) {
    const current = new Set(value[area][field])
    if (current.has(id)) current.delete(id)
    else current.add(id)
    updateScope(area, field === "category_ids"
      ? { category_ids: Array.from(current) }
      : { item_ids: Array.from(current) })
  }

  const filteredItems = useMemo(() => {
    return (Object.keys(AREA_META) as TeacherContentArea[]).reduce<Record<TeacherContentArea, ContentOption[]>>(
      (result, area) => {
        const query = normalizeSearch(queries[area])
        result[area] = options[area].filter((item) => {
          if (!query) return true
          return normalizeSearch(`${item.title} ${item.category_title ?? ""} ${item.locale ?? ""}`).includes(query)
        })
        return result
      },
      { aulas: [], materiais: [], projetos: [] },
    )
  }, [options, queries])

  if (loading) {
    return <p className="text-sm text-slate-300">Carregando categorias e conteúdos...</p>
  }

  if (error) {
    return <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p>
  }

  return (
    <div className="space-y-4">
      {(Object.keys(AREA_META) as TeacherContentArea[]).map((area) => {
        const meta = AREA_META[area]
        const Icon = meta.icon
        const scope = value[area]
        const moduleEnabled = portalPermissions?.[area] !== false
        const categories = area === "projetos" ? options.project_categories : options.categories
        const noSelection = scope.category_ids.length === 0 && scope.item_ids.length === 0

        return (
          <section
            key={area}
            className={`rounded-2xl border p-4 ${
              moduleEnabled
                ? "border-white/15 bg-white/[0.035]"
                : "border-white/5 bg-black/10 opacity-60"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 font-semibold text-white">
                  <Icon className="h-4 w-4 text-cyan-300" />
                  {meta.title}
                </h4>
                <p className="mt-1 text-xs text-slate-300">{meta.description}</p>
              </div>
              {!moduleEnabled ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                  Módulo desativado
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={disabled || !moduleEnabled}
                onClick={() => updateScope(area, { mode: "inherit" })}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  scope.mode === "inherit"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                } disabled:cursor-not-allowed`}
              >
                <strong className="block text-sm">Herdar regras atuais</strong>
                Mantém idioma, país, turma e regras já configuradas nos conteúdos.
              </button>
              <button
                type="button"
                disabled={disabled || !moduleEnabled}
                onClick={() => updateScope(area, { mode: "specific" })}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  scope.mode === "specific"
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                } disabled:cursor-not-allowed`}
              >
                <strong className="block text-sm">Seleção específica</strong>
                Restringe o acesso às categorias e aos itens escolhidos abaixo.
              </button>
            </div>

            {scope.mode === "specific" && moduleEnabled ? (
              <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Categorias completas
                  </p>
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                    {categories.length === 0 ? (
                      <span className="text-xs text-slate-400">Nenhuma categoria disponível.</span>
                    ) : categories.map((category) => {
                      const selected = scope.category_ids.includes(String(category.id))
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleId(area, "category_ids", String(category.id))}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            selected
                              ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {category.title}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      Itens individuais ({scope.item_ids.length} selecionados)
                    </p>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={queries[area]}
                        onChange={(event) => setQueries((current) => ({ ...current, [area]: event.target.value }))}
                        placeholder="Pesquisar conteúdo..."
                        className="w-full rounded-lg border border-white/10 bg-slate-950/60 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/30">
                    {filteredItems[area].length === 0 ? (
                      <p className="p-3 text-xs text-slate-400">Nenhum conteúdo encontrado.</p>
                    ) : filteredItems[area].map((item) => {
                      const selected = scope.item_ids.includes(String(item.id))
                      const coveredByCategory = item.category_id
                        ? scope.category_ids.includes(String(item.category_id))
                        : false
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-3 border-b border-white/5 px-3 py-2.5 last:border-0 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleId(area, "item_ids", String(item.id))}
                            className="mt-0.5 h-4 w-4 accent-cyan-500"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-white">{item.title}</span>
                            <span className="block text-[11px] text-slate-400">
                              {item.category_title || "Sem categoria"}
                              {item.locale ? ` · ${item.locale}` : ""}
                              {coveredByCategory ? " · já incluído pela categoria" : ""}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {noSelection ? (
                  <p className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                    Nenhuma seleção: o professor não verá nenhum conteúdo desta área.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

