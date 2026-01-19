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
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

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
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
        <h1 className="text-4xl font-bold mb-6 text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Editar Material
        </h1>

        <form className="space-y-6" onSubmit={submit}>
          <div>
            <Label className="text-slate-200">Título</Label>
            <Input
              className="bg-white/10 border-white/20 text-white placeholder-slate-400"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">Descrição</Label>
            <Input
              className="bg-white/10 border-white/20 text-white placeholder-slate-400"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">URL</Label>
            <Input
              className="bg-white/10 border-white/20 text-white placeholder-slate-400"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-slate-200">Tipo</Label>
            <select
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
              value={form.file_type}
              onChange={(e) => setForm({ ...form, file_type: e.target.value as Material["file_type"] })}
            >
              <option className="text-black" value="video">Vídeo</option>
              <option className="text-black" value="document">Documento</option>
            </select>
          </div>

          {/* ✅ Idioma */}
          <div>
            <Label className="text-slate-200">Idioma</Label>
            <select
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as Material["language"] })}
            >
              <option className="text-black" value="pt-BR">Português (BR)</option>
              <option className="text-black" value="es">Español</option>
            </select>
          </div>

          <div>
            <Label className="text-slate-200">Categoria</Label>
            <select
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-blue-500"
              value={form.category_id ?? ""}
              onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) || null })}
            >
              <option className="text-black" value="">Sem categoria</option>
              {categories.map((c) => (
                <option className="text-black" key={c.id} value={c.id}>
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
