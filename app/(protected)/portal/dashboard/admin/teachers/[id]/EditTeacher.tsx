"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { Teacher } from "@/app/types/portal"

export default function EditTeacherPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const id = params.id

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/teachers/${id}`, { cache: "no-store" })
      const data = await res.json()
      setTeacher(data)
      setLoading(false)
    }
    load()
  }, [id])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!teacher) return

    await fetch(`/api/admin/teachers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teacher),
    })

    router.push("/portal/dashboard/admin/teachers")
  }

  if (loading || !teacher) return <p className="text-white p-6">Carregando...</p>

  const docLabel = teacher.document_type === "CPF" ? "CPF" : "CI"

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">Editar Professor</h1>

        <form className="space-y-4" onSubmit={save}>
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
              <Label className="text-white">País</Label>
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
                * O tipo de documento/idioma podem ser ajustados automaticamente pelo sistema.
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
          </div>

          {/* Read-only info */}
          <div className="text-sm text-slate-300 pt-2">
            <p><b>Idioma:</b> {teacher.locale}</p>
            <p><b>Tipo de documento:</b> {teacher.document_type}</p>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg">Salvar</Button>
        </form>
      </div>
    </div>
  )
}
