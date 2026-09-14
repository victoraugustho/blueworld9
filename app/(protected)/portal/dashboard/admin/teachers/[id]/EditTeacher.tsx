"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { Category, Teacher, TeacherPortalPermissionKey } from "@/app/types/portal"
import { TURMA_YEAR_OPTIONS } from "@/lib/turma-years"
import {
  DEFAULT_CONTENT_PERMISSIONS,
  TeacherContentPermissionsEditor,
} from "../TeacherContentPermissionsEditor"

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export default function EditTeacherPage({
  params,
  returnHref,
}: {
  params: { id: string }
  returnHref?: string
}) {
  const router = useRouter()
  const id = params.id

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState("")

  useEffect(() => {
    async function load() {
      const [teacherRes, categoriesRes] = await Promise.all([
        fetch(`/api/admin/teachers/${id}`, { cache: "no-store" }),
        fetch("/api/admin/categories", { cache: "no-store" }),
      ])

      const teacherData = await teacherRes.json().catch(() => null)
      const categoriesData = await categoriesRes.json().catch(() => [])

      setTeacher(
        teacherData
          ? {
              ...teacherData,
              category_ids: Array.isArray(teacherData.category_ids) ? teacherData.category_ids : [],
              student_years: Array.isArray(teacherData.student_years)
                ? teacherData.student_years.map((value: any) => Number(value))
                : [],
              portal_permissions: {
                aulas: teacherData.portal_permissions?.aulas !== false,
                agenda_notas: teacherData.portal_permissions?.agenda_notas !== false,
                materiais: teacherData.portal_permissions?.materiais !== false,
                projetos: teacherData.portal_permissions?.projetos !== false,
                ia: teacherData.portal_permissions?.ia !== false,
              },
              content_permissions: {
                aulas: { ...DEFAULT_CONTENT_PERMISSIONS.aulas, ...(teacherData.content_permissions?.aulas ?? {}) },
                materiais: { ...DEFAULT_CONTENT_PERMISSIONS.materiais, ...(teacherData.content_permissions?.materiais ?? {}) },
                projetos: { ...DEFAULT_CONTENT_PERMISSIONS.projetos, ...(teacherData.content_permissions?.projetos ?? {}) },
              },
            }
          : null
      )
      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setLoading(false)
    }
    load()
  }, [id])

  function toggleCategory(categoryId: number) {
    if (!teacher) return
    const current = new Set(teacher.category_ids ?? [])
    if (current.has(categoryId)) current.delete(categoryId)
    else current.add(categoryId)

    setTeacher({ ...teacher, category_ids: Array.from(current) })
  }

  function toggleStudentYear(studentYear: number) {
    if (!teacher) return
    const current = new Set((teacher.student_years ?? []).map((value) => Number(value)))
    if (current.has(studentYear)) current.delete(studentYear)
    else current.add(studentYear)

    setTeacher({ ...teacher, student_years: Array.from(current).sort((a, b) => a - b) })
  }

  function togglePortalPermission(permission: TeacherPortalPermissionKey) {
    if (!teacher) return
    const current = teacher.portal_permissions ?? {
      aulas: true,
      agenda_notas: true,
      materiais: true,
      projetos: true,
      ia: true,
    }
    setTeacher({
      ...teacher,
      portal_permissions: {
        ...current,
        [permission]: !current[permission],
      },
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!teacher) return

    setSaving(true)
    const res = await fetch(`/api/admin/teachers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teacher),
    })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar professor")
      return
    }

    router.push(returnHref ?? "/portal/dashboard/admin/teachers")
  }

  const filteredCategories = useMemo(() => {
    const query = normalizeSearch(categoryQuery)
    if (!query) return categories
    return categories.filter((item) => item.name.toLowerCase().includes(query))
  }, [categoryQuery, categories])

  if (loading || !teacher) return <p className="text-white p-6">Carregando...</p>

  const docLabel = teacher.document_type === "CPF" ? "CPF" : "CI"
  const selectedCategoryCount = (teacher.category_ids ?? []).length
  const selectedYearCount = (teacher.student_years ?? []).length

  const yearGroups = {
    age: TURMA_YEAR_OPTIONS.filter((item) => item.group === "age"),
    grade: TURMA_YEAR_OPTIONS.filter((item) => item.group === "grade"),
    high: TURMA_YEAR_OPTIONS.filter((item) => item.group === "high"),
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">Editar Professor</h1>

        <form className="space-y-5" onSubmit={save}>
          <div>
            <Label className="text-white">Nome</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.name}
              onChange={(e) => setTeacher({ ...teacher, name: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-white">Email</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.email}
              onChange={(e) => setTeacher({ ...teacher, email: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-white">Telefone</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.phone}
              onChange={(e) => setTeacher({ ...teacher, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Pais</Label>
              <select
                className="w-full p-2 rounded bg-white/10 border border-white/20 text-white"
                value={teacher.country}
                onChange={(e) => setTeacher({ ...teacher, country: e.target.value as Teacher["country"] })}
              >
                <option className="text-black" value="BR">Brasil</option>
                <option className="text-black" value="UY">Uruguay</option>
                <option className="text-black" value="PY">Paraguay</option>
              </select>
              <p className="text-xs text-slate-300 mt-1">
                O tipo de documento e idioma podem ser ajustados automaticamente.
              </p>
            </div>

            <div>
              <Label className="text-white">{docLabel}</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                value={teacher.document_number}
                onChange={(e) =>
                  setTeacher({ ...teacher, document_number: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Categorias vinculadas</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              placeholder="Buscar categoria..."
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
            />
            <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-white/20 bg-slate-950/40">
              {filteredCategories.length === 0 && (
                <div className="p-3 text-sm text-slate-400">Nenhuma categoria encontrada.</div>
              )}
              {filteredCategories.map((category) => {
                const checked = (teacher.category_ids ?? []).includes(category.id)
                return (
                  <label
                    key={category.id}
                    className="flex items-start gap-2 px-3 py-2 border-b border-white/10 last:border-none cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => toggleCategory(category.id)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{category.name}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-slate-300">Selecionadas: {selectedCategoryCount}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Turmas (Ano) vinculadas</Label>
            <div className="rounded-lg border border-white/20 bg-slate-950/40 p-3 space-y-3">
              <div>
                <p className="text-xs text-slate-300 mb-1">Idade</p>
                <div className="flex flex-wrap gap-2">
                  {yearGroups.age.map((item) => {
                    const checked = (teacher.student_years ?? []).includes(item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleStudentYear(item.value)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${
                          checked
                            ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-300 mb-1">Ano</p>
                <div className="flex flex-wrap gap-2">
                  {yearGroups.grade.map((item) => {
                    const checked = (teacher.student_years ?? []).includes(item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleStudentYear(item.value)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${
                          checked
                            ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-300 mb-1">Ensino Medio</p>
                <div className="flex flex-wrap gap-2">
                  {yearGroups.high.map((item) => {
                    const checked = (teacher.student_years ?? []).includes(item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleStudentYear(item.value)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition ${
                          checked
                            ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-300">Selecionadas: {selectedYearCount}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={teacher.approved}
                onChange={(e) => setTeacher({ ...teacher, approved: e.target.checked })}
              />
              <Label className="text-white">Aprovado</Label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={teacher.active ?? true}
                onChange={(e) => setTeacher({ ...teacher, active: e.target.checked })}
              />
              <Label className="text-white">Ativo</Label>
            </div>

            <div className="flex items-center gap-3 md:col-span-2 rounded-lg border border-white/15 bg-slate-950/30 p-3">
              <input
                type="checkbox"
                checked={teacher.can_download !== false}
                onChange={(e) => setTeacher({ ...teacher, can_download: e.target.checked })}
              />
              <div>
                <Label className="text-white">Permitir downloads e exportações</Label>
                <p className="text-xs text-slate-300 mt-1">
                  Desative para acessos de teste. O professor continua vendo as telas, mas não recebe ações de download.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/15 bg-slate-950/30 p-4">
            <div>
              <Label className="text-white">Módulos liberados para o professor</Label>
              <p className="mt-1 text-xs text-slate-300">
                O papel administrativo não pode ser alterado nesta página.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["aulas", "Aulas em vídeo"],
                ["agenda_notas", "Agenda + Notas"],
                ["materiais", "Materiais"],
                ["projetos", "Projetos"],
                ["ia", "Assistente de IA"],
              ] as Array<[TeacherPortalPermissionKey, string]>).map(([permission, label]) => (
                <label
                  key={permission}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10"
                >
                  <input
                    type="checkbox"
                    checked={teacher.portal_permissions?.[permission] !== false}
                    onChange={() => togglePortalPermission(permission)}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/15 bg-slate-950/30 p-4">
            <div>
              <Label className="text-white">Categorias e conteúdos liberados</Label>
              <p className="mt-1 text-xs text-slate-300">
                Use o modo específico somente quando este professor precisar de uma seleção diferente das regras atuais.
              </p>
            </div>
            <TeacherContentPermissionsEditor
              value={teacher.content_permissions ?? DEFAULT_CONTENT_PERMISSIONS}
              onChange={(content_permissions) => setTeacher({ ...teacher, content_permissions })}
              portalPermissions={teacher.portal_permissions}
              disabled={saving}
            />
          </div>

          <div className="text-sm text-slate-300 pt-2">
            <p><b>Idioma:</b> {teacher.locale}</p>
            <p><b>Tipo de documento:</b> {teacher.document_type}</p>
          </div>

          <Button disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
