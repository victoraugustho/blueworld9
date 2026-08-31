"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { Category, MaterialAccessPolicyV2, Teacher } from "@/app/types/portal"
import MaterialAccessPolicyEditor from "@/components/admin/MaterialAccessPolicyEditor"
import { createDefaultMaterialAccessPolicy } from "@/lib/material-access-policy"

type MaterialForm = {
  title: string
  description: string
  video_notes: string
  file_url: string
  file_type: "video" | "document"
  category_id: string
  student_year: string
  language: "pt-BR" | "es"
  access_scope: "all" | "specific"
  teacher_ids: string[]
  access_policy: MaterialAccessPolicyV2
}

export default function NewMaterialPage() {
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<MaterialForm>({
    title: "",
    description: "",
    video_notes: "",
    file_url: "",
    file_type: "video",
    category_id: "",
    student_year: "",
    language: "pt-BR",
    access_scope: "all",
    teacher_ids: [],
    access_policy: createDefaultMaterialAccessPolicy("pt-BR"),
  })

  const ageYears = [3, 4, 5]
  const highYears = [1, 2, 3]
  const gradeYears = Array.from({ length: 9 }, (_, i) => i + 1)

  async function loadData() {
    setLoading(true)
    try {
      const [categoriesRes, teachersRes] = await Promise.all([
        fetch("/api/admin/categories", { cache: "no-store" }),
        fetch("/api/admin/teachers", { cache: "no-store" }),
      ])

      const categoriesData = await categoriesRes.json().catch(() => [])
      const teachersData = await teachersRes.json().catch(() => ({}))
      const approvedTeachers = Array.isArray(teachersData?.approved) ? teachersData.approved : []

      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setTeachers(approvedTeachers.sort((a: Teacher, b: Teacher) => a.name.localeCompare(b.name)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function setMaterialType(nextType: MaterialForm["file_type"]) {
    setForm((prev) => ({
      ...prev,
      file_type: nextType,
      video_notes: nextType === "video" ? prev.video_notes : "",
    }))
  }

  async function submitMaterial(e: React.FormEvent) {
    e.preventDefault()

    setSaving(true)
    const res = await fetch("/api/admin/materials/create", {
      method: "POST",
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

  return (
    <div className="min-h-screen flex flex-col gap-8 items-start justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-4xl bg-slate-900/20 backdrop-blur-xl border border-cyan-500/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Novo Material
          </CardTitle>
          <p className="text-sm text-slate-300">
            Organização do conteúdo e controle de acesso são independentes e transparentes.
            {" "}
            <Link href="/portal/dashboard/admin/materials?section=turmas" className="text-cyan-300 hover:text-cyan-200 underline">
              Gerenciar categorias e turmas
            </Link>
          </p>
        </CardHeader>

        <CardContent>
          <form className="space-y-6" onSubmit={submitMaterial}>
            <div className="space-y-3">
              <Label className="text-white mr-2">Tipo de material</Label>
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
              <p className="text-xs text-slate-400">
                {form.file_type === "video"
                  ? "Modo video: informe link (YouTube) e observacoes para apoiar a aula do professor."
                  : "Modo documento: informe o link do arquivo/material de apoio."}
              </p>
            </div>

            <div className="space-y-2">
                <Label className="text-white">Título</Label>
              <Input
                  placeholder="Ex: Introdução à Robótica"
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">
                {form.file_type === "video" ? "Descricao da aula" : "Descricao do material"}
              </Label>
              <Textarea
                placeholder={
                  form.file_type === "video"
                    ? "Resumo rapido do que sera ensinado neste video..."
                    : "Descreva o material..."
                }
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">
                {form.file_type === "video" ? "URL do video" : "URL do documento"}
              </Label>
              <Input
                placeholder={
                  form.file_type === "video"
                    ? "https://youtube.com/..."
                    : "https://drive.google.com/... ou https://seusite.com/arquivo.pdf"
                }
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                required
              />
            </div>

            {form.file_type === "video" && (
              <div className="space-y-2">
                <Label className="text-white">Observacoes do video (opcional)</Label>
                <Textarea
                  placeholder="Ex: foco da aula, pontos de atencao, atividade sugerida apos assistir..."
                  className="bg-slate-800/50 border-slate-700 text-white"
                  rows={4}
                  value={form.video_notes}
                  onChange={(e) => setForm({ ...form, video_notes: e.target.value })}
                />
                <p className="text-xs text-slate-400">
                  Esse texto aparece para o professor na pagina de Aulas, logo abaixo do player.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Idioma do conteúdo</Label>
                <select
                  className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  value={form.language}
                  onChange={(e) => {
                    const language = e.target.value as MaterialForm["language"]
                    setForm((prev) => ({
                      ...prev,
                      language,
                      access_policy:
                        prev.access_policy.locales.length === 1 && prev.access_policy.locales[0] === prev.language
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
              <div className="space-y-2">
                <Label className="text-white">Categoria de organização (opcional)</Label>
                <select
                  className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  disabled={loading}
                >
                  <option className="text-white" value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option className="text-white" key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Organiza o material nas telas. O acesso é definido separadamente abaixo.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Ano/turma de organização (opcional)</Label>
                <select
                  className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  value={form.student_year}
                  onChange={(e) => setForm({ ...form, student_year: e.target.value })}
                >
                  <option className="text-white" value="">Materiais complementares</option>
                  <optgroup label="Idade (anos)">
                    {ageYears.map((y) => (
                      <option className="text-white" key={`age-${y}`} value={String(100 + y)}>
                        {y} anos
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ensino Medio">
                    {highYears.map((y) => (
                      <option className="text-white" key={`hs-${y}`} value={String(200 + y)}>
                        Ensino Medio {y}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ano da turma (serie)">
                    {gradeYears.map((y) => (
                      <option className="text-white" key={`grade-${y}`} value={String(y)}>
                        Ano {y}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-slate-400">
                  Classifica o conteúdo por etapa. O acesso é definido separadamente abaixo.
                </p>
              </div>
            </div>

            <MaterialAccessPolicyEditor
              policy={form.access_policy}
              onChange={(access_policy) => {
                if (access_policy) setForm((prev) => ({ ...prev, access_policy }))
              }}
              teachers={teachers}
              categories={categories}
              contentLanguage={form.language}
            />

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 py-6"
            >
              {saving ? "Salvando..." : "Salvar Material"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
