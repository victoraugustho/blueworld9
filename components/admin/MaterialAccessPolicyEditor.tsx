"use client"

import { useMemo, useState } from "react"
import { Search, ShieldCheck, ShieldX, Users } from "lucide-react"
import type { Category, MaterialAccessPolicyV2, MaterialLanguage, Teacher } from "@/app/types/portal"
import {
  createDefaultMaterialAccessPolicy,
  evaluateMaterialAccessPolicy,
} from "@/lib/material-access-policy"

type LegacyAccess = {
  language: MaterialLanguage
  categoryId: number | null
  studentYear: number | null
  accessScope: "all" | "specific"
  teacherIds: string[]
}

type Props = {
  policy: MaterialAccessPolicyV2 | null
  onChange: (policy: MaterialAccessPolicyV2 | null) => void
  teachers: Teacher[]
  categories: Category[]
  contentLanguage: MaterialLanguage
  legacyAccess?: LegacyAccess
}

const countries = [
  { value: "BR" as const, label: "Brasil" },
  { value: "UY" as const, label: "Uruguai" },
  { value: "PY" as const, label: "Paraguai" },
]

const years = [103, 104, 105, 1, 2, 3, 4, 5, 6, 7, 8, 9, 201, 202, 203]

function yearLabel(year: number) {
  if (year >= 103 && year <= 105) return `${year - 100} anos`
  if (year >= 201 && year <= 203) return `${year - 200}º Ensino Médio`
  return `${year}º ano`
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function legacyEvaluation(legacy: LegacyAccess, teacher: Teacher) {
  if (teacher.locale !== legacy.language) return { allowed: false, reason: "Idioma diferente" }
  if (legacy.categoryId && !(teacher.category_ids ?? []).includes(legacy.categoryId)) {
    return { allowed: false, reason: "Sem vínculo com a categoria" }
  }
  if (legacy.studentYear && !(teacher.student_years ?? []).includes(legacy.studentYear)) {
    return { allowed: false, reason: "Sem vínculo com o ano/turma" }
  }
  if (legacy.accessScope === "specific" && !legacy.teacherIds.includes(teacher.id)) {
    return { allowed: false, reason: "Fora da lista específica" }
  }
  return { allowed: true, reason: "Atende à regra legada" }
}

export default function MaterialAccessPolicyEditor({
  policy,
  onChange,
  teachers,
  categories,
  contentLanguage,
  legacyAccess,
}: Props) {
  const [query, setQuery] = useState("")
  const [previewFilter, setPreviewFilter] = useState<"all" | "allowed" | "denied">("all")

  const evaluatedTeachers = useMemo(() => {
    return teachers
      .map((teacher) => ({
        teacher,
        result: policy
          ? evaluateMaterialAccessPolicy(policy, teacher)
          : legacyAccess
            ? legacyEvaluation(legacyAccess, teacher)
            : { allowed: false, reason: "Política não configurada" },
      }))
      .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, "pt-BR"))
  }, [legacyAccess, policy, teachers])

  const filteredTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR")
    return evaluatedTeachers.filter(({ teacher, result }) => {
      if (previewFilter === "allowed" && !result.allowed) return false
      if (previewFilter === "denied" && result.allowed) return false
      if (!normalizedQuery) return true
      return `${teacher.name} ${teacher.email} ${teacher.country} ${teacher.locale}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery)
    })
  }, [evaluatedTeachers, previewFilter, query])

  const allowedCount = evaluatedTeachers.filter(({ result }) => result.allowed).length

  function patchPolicy(patch: Partial<MaterialAccessPolicyV2>) {
    if (!policy) return
    onChange({ ...policy, ...patch })
  }

  function setTeacherOverride(teacherId: string, action: "include" | "exclude" | "clear") {
    if (!policy) return
    const includes = policy.include_teacher_ids.filter((id) => id !== teacherId)
    const excludes = policy.exclude_teacher_ids.filter((id) => id !== teacherId)
    if (action === "include") includes.push(teacherId)
    if (action === "exclude") excludes.push(teacherId)
    patchPolicy({ include_teacher_ids: includes, exclude_teacher_ids: excludes })
  }

  if (!policy) {
    return (
      <section className="space-y-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-200">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="font-semibold">Controle de acesso legado</h3>
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Este material continua exatamente com as regras atuais até você optar pela conversão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(createDefaultMaterialAccessPolicy(contentLanguage))}
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
          >
            Converter para grupos dinâmicos
          </button>
        </div>
        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <span className="rounded-lg bg-black/20 px-3 py-2">Idioma: {legacyAccess?.language ?? contentLanguage}</span>
          <span className="rounded-lg bg-black/20 px-3 py-2">Categoria: {legacyAccess?.categoryId ?? "todas"}</span>
          <span className="rounded-lg bg-black/20 px-3 py-2">Ano/turma: {legacyAccess?.studentYear ?? "todos"}</span>
          <span className="rounded-lg bg-black/20 px-3 py-2">
            Professores: {legacyAccess?.accessScope === "specific" ? legacyAccess.teacherIds.length : "todos elegíveis"}
          </span>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5 rounded-2xl border border-cyan-400/20 bg-slate-950/45 p-4 shadow-xl backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <h3 className="font-semibold">Quem pode acessar este material?</h3>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            O idioma do conteúdo é apenas informativo. Um professor de outro idioma pode receber acesso por inclusão individual ou pelas condições escolhidas.
          </p>
        </div>
        {legacyAccess && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-amber-200 underline decoration-amber-300/40 underline-offset-4"
          >
            Cancelar conversão
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {([
          ["all", "Todos", "Libera todos, exceto exclusões"],
          ["dynamic", "Grupos dinâmicos", "Aplica condições automáticas"],
          ["specific", "Lista específica", "Somente inclusões individuais"],
        ] as const).map(([mode, label, description]) => (
          <button
            key={mode}
            type="button"
            onClick={() => patchPolicy({ mode })}
            className={`rounded-xl border p-3 text-left transition ${
              policy.mode === mode
                ? "border-cyan-400/55 bg-cyan-500/15 text-white"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className="mt-1 block text-xs text-slate-400">{description}</span>
          </button>
        ))}
      </div>

      {policy.mode === "dynamic" && (
        <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Combinação das condições</p>
              <p className="text-xs text-slate-400">Escolha se o professor precisa atender todas ou apenas uma condição.</p>
            </div>
            <div className="inline-flex w-fit rounded-lg border border-white/10 bg-black/20 p-1">
              {(["all", "any"] as const).map((strategy) => (
                <button
                  key={strategy}
                  type="button"
                  onClick={() => patchPolicy({ match_strategy: strategy })}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    policy.match_strategy === strategy ? "bg-cyan-500 text-slate-950" : "text-slate-300"
                  }`}
                >
                  {strategy === "all" ? "Todas" : "Qualquer uma"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Idioma do professor</p>
            <div className="flex flex-wrap gap-2">
              {(["pt-BR", "es"] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => patchPolicy({ locales: toggleValue(policy.locales, locale) })}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    policy.locales.includes(locale)
                      ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  {locale === "pt-BR" ? "Português" : "Español"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">País</p>
            <div className="flex flex-wrap gap-2">
              {countries.map((country) => (
                <button
                  key={country.value}
                  type="button"
                  onClick={() => patchPolicy({ countries: toggleValue(policy.countries, country.value) })}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    policy.countries.includes(country.value)
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  {country.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Ano/turma vinculada ao professor</p>
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => patchPolicy({ student_years: toggleValue(policy.student_years, year) })}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    policy.student_years.includes(year)
                      ? "border-blue-400/50 bg-blue-500/20 text-blue-100"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  {yearLabel(year)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Categoria vinculada ao professor</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => patchPolicy({ category_ids: toggleValue(policy.category_ids, category.id) })}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    policy.category_ids.includes(category.id)
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Exceções e pré-visualização efetiva</p>
            <p className="text-xs text-slate-400">Inclusão libera independentemente do idioma; exclusão sempre bloqueia.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">{allowedCount} com acesso</span>
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-rose-200">{teachers.length - allowedCount} sem acesso</span>
          </div>
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, e-mail, país ou idioma..."
              className="w-full rounded-lg border border-white/10 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-400/50"
            />
          </label>
          <div className="inline-flex w-fit rounded-lg border border-white/10 bg-slate-900/70 p-1">
            {(["all", "allowed", "denied"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPreviewFilter(filter)}
                className={`rounded-md px-2.5 py-1 text-xs ${previewFilter === filter ? "bg-white/15 text-white" : "text-slate-400"}`}
              >
                {filter === "all" ? "Todos" : filter === "allowed" ? "Com acesso" : "Sem acesso"}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-white/10">
          {filteredTeachers.map(({ teacher, result }) => {
            const override = policy.exclude_teacher_ids.includes(teacher.id)
              ? "exclude"
              : policy.include_teacher_ids.includes(teacher.id)
                ? "include"
                : "clear"
            return (
              <div key={teacher.id} className="grid gap-2 border-b border-white/5 p-3 last:border-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {result.allowed ? <ShieldCheck className="h-4 w-4 text-emerald-300" /> : <ShieldX className="h-4 w-4 text-rose-300" />}
                    <span className="truncate text-sm font-medium text-white">{teacher.name}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{teacher.email} · {result.reason}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTeacherOverride(teacher.id, override === "include" ? "clear" : "include")}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      override === "include" ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100" : "border-white/10 text-slate-300"
                    }`}
                  >
                    Incluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherOverride(teacher.id, override === "exclude" ? "clear" : "exclude")}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      override === "exclude" ? "border-rose-400/50 bg-rose-500/20 text-rose-100" : "border-white/10 text-slate-300"
                    }`}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
          {filteredTeachers.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-400">
              <Users className="h-4 w-4" /> Nenhum professor encontrado.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
