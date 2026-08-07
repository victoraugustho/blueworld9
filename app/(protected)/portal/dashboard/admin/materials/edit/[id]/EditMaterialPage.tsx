"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Material, Category, Teacher } from "@/app/types/portal"

interface EditPageProps {
  params: { id: string }
}

type MaterialForm = Material & {
  access_scope: "all" | "specific"
  teacher_ids: string[]
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export default function EditMaterialPage({ params }: EditPageProps) {
  const id = params.id
  const router = useRouter()

  const [form, setForm] = useState<MaterialForm>({
    id,
    title: "",
    description: "",
    video_notes: "",
    file_url: "",
    file_type: "video",
    category_id: null,
    language: "pt-BR",
    student_year: null,
    access_scope: "all",
    teacher_ids: [],
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teacherQuery, setTeacherQuery] = useState("")
  const ageYears = [3, 4, 5]
  const highYears = [1, 2, 3]
  const gradeYears = Array.from({ length: 9 }, (_, i) => i + 1)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [materialRes, categoriesRes, teachersRes] = await Promise.all([
        fetch(`/api/admin/materials/${id}`, { cache: "no-store" }),
        fetch("/api/admin/categories", { cache: "no-store" }),
        fetch("/api/admin/teachers", { cache: "no-store" }),
      ])

      const materialData = await materialRes.json().catch(() => null)
      const categoriesData = await categoriesRes.json().catch(() => [])
      const teachersData = await teachersRes.json().catch(() => ({}))
      const approvedTeachers = Array.isArray(teachersData?.approved) ? teachersData.approved : []

      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setTeachers(approvedTeachers.sort((a: Teacher, b: Teacher) => a.name.localeCompare(b.name)))

      if (materialData?.id) {
        setForm({
          ...materialData,
          video_notes: String(materialData.video_notes ?? ""),
          language: materialData.language === "es" ? "es" : "pt-BR",
          access_scope: materialData.access_scope === "specific" ? "specific" : "all",
          teacher_ids: Array.isArray(materialData.teacher_ids) ? materialData.teacher_ids : [],
        })
      }

      setLoading(false)
    }

    load()
  }, [id])

  function toggleTeacher(teacherId: string) {
    setForm((prev) => {
      const current = new Set(prev.teacher_ids ?? [])
      if (current.has(teacherId)) current.delete(teacherId)
      else current.add(teacherId)
      const nextIds = Array.from(current)
      return {
        ...prev,
        teacher_ids: nextIds,
        access_scope: nextIds.length > 0 ? "specific" : prev.access_scope,
      }
    })
  }

  function setMaterialType(nextType: Material["file_type"]) {
    setForm((prev) => ({
      ...prev,
      file_type: nextType,
      video_notes: nextType === "video" ? String(prev.video_notes ?? "") : "",
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (form.access_scope === "specific" && (form.teacher_ids?.length ?? 0) === 0) {
      alert("Selecione ao menos um professor para acesso especifico.")
      return
    }

    setSaving(true)
    const res = await fetch(`/api/admin/materials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar material")
      return
    }

    router.push("/portal/dashboard/admin/materials")
  }

  const filteredTeachers = useMemo(() => {
    const query = normalizeSearch(teacherQuery)
    if (!query) return teachers
    return teachers.filter((teacher) => {
      const hay = `${teacher.name} ${teacher.email}`.toLowerCase()
      return hay.includes(query)
    })
  }, [teacherQuery, teachers])

  if (loading) return <p className="text-white p-6">Carregando...</p>

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-slate-900/40 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
        <h1 className="text-4xl font-bold mb-6 text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Editar Material
        </h1>

        <p className="text-slate-300 text-sm mb-6">
          Precisa ajustar categorias/turmas?
          {" "}
          <Link href="/portal/dashboard/admin/materials?section=turmas" className="text-cyan-300 hover:text-cyan-200 underline">
            Gerenciar categorias e turmas
          </Link>
        </p>

        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-3">
            <Label className="text-slate-200">Tipo de material</Label>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1">
              <button
                type="button"
                onClick={() => setMaterialType("video")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  form.file_type === "video"
                    ? "bg-cyan-600 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => setMaterialType("document")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  form.file_type === "document"
                    ? "bg-cyan-600 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                Documento
              </button>
            </div>
          </div>

          <div>
            <Label className="text-slate-200">Titulo</Label>
            <Input
              className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">
              {form.file_type === "video" ? "Descricao da aula" : "Descricao do material"}
            </Label>
            <Input
              className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">
              {form.file_type === "video" ? "URL do video" : "URL do documento"}
            </Label>
            <Input
              className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            />
          </div>

          {form.file_type === "video" && (
            <div>
              <Label className="text-slate-200">Observacoes do video (opcional)</Label>
              <Textarea
                className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
                rows={4}
                value={form.video_notes ?? ""}
                onChange={(e) => setForm({ ...form, video_notes: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-slate-200">Idioma</Label>
              <select
                className="w-full p-3 rounded-lg bg-slate-700 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as Material["language"] })}
              >
                <option className="text-white" value="pt-BR">Portugues (BR)</option>
                <option className="text-white" value="es">Espanol</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-200">Turma (Ano) opcional</Label>
              <select
                className="w-full p-3 rounded-lg bg-slate-700 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
                value={form.student_year ?? ""}
                onChange={(e) =>
                  setForm({ ...form, student_year: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option className="text-white bg-slate-700" value="">Materiais complementares</option>
                <optgroup label="Idade (anos)">
                  {ageYears.map((y) => (
                    <option className="text-white bg-slate-700" key={`age-${y}`} value={100 + y}>
                      {y} anos
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ensino Medio">
                  {highYears.map((y) => (
                    <option className="text-white bg-slate-700" key={`hs-${y}`} value={200 + y}>
                      Ensino Medio {y}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ano da turma (serie)">
                  {gradeYears.map((y) => (
                    <option className="text-white bg-slate-700 " key={`grade-${y}`} value={y}>
                      Ano {y}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Se preencher, o material aparece somente para professores vinculados a este ano/turma.
              </p>
            </div>

            <div>
              <Label className="text-slate-200">Categoria (opcional)</Label>
              <select
                className="w-full p-3 rounded-lg bg-slate-700 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
                value={form.category_id ?? ""}
                onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) || null })}
              >
                <option className="text-white" value="">Sem categoria</option>
                {categories.map((c) => (
                  <option className="text-white" key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Se preencher, o material aparece somente para professores vinculados a esta categoria.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-200">Acesso ao material</Label>
            <p className="text-xs text-slate-400">
              Regras aplicadas em conjunto: categoria + turma (ano) + acesso do material.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, access_scope: "all", teacher_ids: [] }))}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
                  form.access_scope === "all"
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                }`}
              >
                Todos os professores
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, access_scope: "specific" }))}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs border transition ${
                  form.access_scope === "specific"
                    ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
                    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                }`}
              >
                Professores especificos
              </button>
            </div>

            {form.access_scope === "specific" && (
              <div className="space-y-2">
                <Input
                  className="bg-slate-800/50 border-slate-700 text-white"
                  placeholder="Buscar professor..."
                  value={teacherQuery}
                  onChange={(e) => setTeacherQuery(e.target.value)}
                />
                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/40">
                  {filteredTeachers.length === 0 && (
                    <div className="p-3 text-sm text-slate-400">Nenhum professor encontrado.</div>
                  )}
                  {filteredTeachers.map((teacher) => {
                    const checked = (form.teacher_ids ?? []).includes(teacher.id)
                    return (
                      <label
                        key={teacher.id}
                        className="flex items-start gap-2 px-3 py-2 border-b border-white/5 last:border-none cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleTeacher(teacher.id)}
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{teacher.name}</div>
                          <div className="text-xs text-slate-400 truncate">{teacher.email}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  Selecionados: {(form.teacher_ids ?? []).length}
                </p>
              </div>
            )}
          </div>

          <Button
            disabled={saving}
            className="w-full py-3 text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            {saving ? "Salvando..." : "Salvar Alteracoes"}
          </Button>
        </form>
      </div>
    </div>
  )
}
