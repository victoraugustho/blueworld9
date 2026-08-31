"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Material, Category, Teacher } from "@/app/types/portal"
import MaterialAccessPolicyEditor from "@/components/admin/MaterialAccessPolicyEditor"

interface EditPageProps {
  params: { id: string }
}

type MaterialForm = Material & {
  access_scope: "all" | "specific"
  teacher_ids: string[]
  access_policy: Material["access_policy"]
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
    access_policy: null,
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [startedAsLegacy, setStartedAsLegacy] = useState(false)
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
        const hasPolicy = materialData.access_policy && Number(materialData.access_policy.version) === 2
        setStartedAsLegacy(!hasPolicy)
        setForm({
          ...materialData,
          video_notes: String(materialData.video_notes ?? ""),
          language: materialData.language === "es" ? "es" : "pt-BR",
          access_scope: materialData.access_scope === "specific" ? "specific" : "all",
          teacher_ids: Array.isArray(materialData.teacher_ids) ? materialData.teacher_ids : [],
          access_policy: hasPolicy ? materialData.access_policy : null,
        })
      }

      setLoading(false)
    }

    load()
  }, [id])

  function setMaterialType(nextType: Material["file_type"]) {
    setForm((prev) => ({
      ...prev,
      file_type: nextType,
      video_notes: nextType === "video" ? String(prev.video_notes ?? "") : "",
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.access_policy && form.access_scope === "specific" && (form.teacher_ids?.length ?? 0) === 0) {
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
            <Label className="text-slate-200">Título</Label>
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
              <Label className="text-slate-200">Idioma do conteúdo</Label>
              <select
                className="w-full p-3 rounded-lg bg-slate-700 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
                value={form.language}
                onChange={(e) => {
                  const language = e.target.value as Material["language"]
                  setForm((prev) => ({
                    ...prev,
                    language,
                    access_policy:
                      prev.access_policy?.locales.length === 1 && prev.access_policy.locales[0] === prev.language
                        ? { ...prev.access_policy, locales: [language] }
                        : prev.access_policy,
                  }))
                }}
              >
                <option className="text-white" value="pt-BR">Português (BR)</option>
                <option className="text-white" value="es">Español</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-200">Ano/turma de organização (opcional)</Label>
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
                {form.access_policy
                  ? "Classifica o conteúdo por etapa. O acesso é definido separadamente abaixo."
                  : "No controle legado, este campo também restringe o acesso aos professores vinculados."}
              </p>
            </div>

            <div>
              <Label className="text-slate-200">Categoria de organização (opcional)</Label>
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
                {form.access_policy
                  ? "Organiza o material nas telas. O acesso é definido separadamente abaixo."
                  : "No controle legado, este campo também restringe o acesso aos professores vinculados."}
              </p>
            </div>
          </div>

          <MaterialAccessPolicyEditor
            policy={form.access_policy ?? null}
            onChange={(access_policy) => setForm((prev) => ({ ...prev, access_policy }))}
            teachers={teachers}
            categories={categories}
            contentLanguage={form.language}
            legacyAccess={startedAsLegacy ? {
              language: form.language,
              categoryId: form.category_id ?? null,
              studentYear: form.student_year ?? null,
              accessScope: form.access_scope,
              teacherIds: form.teacher_ids ?? [],
            } : undefined}
          />

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
