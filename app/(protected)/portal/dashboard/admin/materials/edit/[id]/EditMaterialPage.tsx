"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Material, Category } from "@/app/types/portal"

interface EditPageProps {
  params: { id: string }
}

export default function EditMaterialPage({ params }: EditPageProps) {
  const id = params.id
  const router = useRouter()

  const [form, setForm] = useState<Material>({
    id,
    title: "",
    description: "",
    file_url: "",
    file_type: "video",
    category_id: null,
    language: "pt-BR",
    student_year: null,
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const ageYears = [3, 4, 5]
  const highYears = [1, 2, 3]
  const gradeYears = Array.from({ length: 9 }, (_, i) => i + 1)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const res = await fetch(`/api/admin/materials/${id}`)
      const data = await res.json()

      const catRes = await fetch("/api/admin/categories")
      const catData = await catRes.json()

      setCategories(catData ?? [])
      setForm({
        ...data,
        language: data.language ?? "pt-BR",
      })
      setLoading(false)
    }

    load()
  }, [id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    await fetch(`/api/admin/materials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    router.push("/portal/dashboard/admin/materials")
  }

  if (loading) return <p className="text-white p-6">Carregando...</p>

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-900/40 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
        <h1 className="text-4xl font-bold mb-6 text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Editar Material
        </h1>

        <form className="space-y-6" onSubmit={submit}>
          <div>
            <Label className="text-slate-200">Título</Label>
            <Input
              className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">Descrição</Label>
            <Input
              className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">URL</Label>
            <Input
              className="bg-slate-700 border-white/20 text-white placeholder-slate-400"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">Tipo</Label>
            <select
              className="w-full p-3 rounded-lg bg-slate-700 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
              value={form.file_type}
              onChange={(e) => setForm({ ...form, file_type: e.target.value as Material["file_type"] })}
            >
              <option className="text-white" value="video">Vídeo</option>
              <option className="text-white" value="document">Documento</option>
            </select>
          </div>

          {/* ✅ Idioma */}
          <div>
            <Label className="text-slate-200">Idioma</Label>
            <select
              className="w-full p-3 rounded-lg bg-slate-700 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as Material["language"] })}
            >
              <option className="text-white" value="pt-BR">Português (BR)</option>
              <option className="text-white" value="es">Español</option>
            </select>
          </div>

          <div>
            <Label className="text-slate-200">Ano do Aluno (opcional)</Label>
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
              <optgroup label="Ano (serie)">
                {gradeYears.map((y) => (
                  <option className="text-white bg-slate-700 " key={`grade-${y}`} value={y}>
                    Ano {y}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>


          <div>
            <Label className="text-slate-200">Categoria</Label>
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
          </div>

          <Button className="w-full py-3 text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg hover:shadow-cyan-500/30 transition-all">
            Salvar Alterações
          </Button>
        </form>
      </div>
    </div>
  )
}
