"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type N = {
  title: string
  message: string
  audience: "all" | "country" | "locale" | "teacher"
  country?: "BR" | "UY" | "PY" | null
  locale?: "pt-BR" | "es" | null
  teacher_id?: string | null
  active: boolean
  expires_at?: string | null
}

export default function NotificationForm({ id }: { id?: string }) {
  const router = useRouter()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<N>({
    title: "",
    message: "",
    audience: "all",
    country: null,
    locale: null,
    teacher_id: null,
    active: true,
    expires_at: null,
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isEdit || !id) return

    ;(async () => {
      const res = await fetch(`/api/admin/notifications/${id}`, { cache: "no-store" })
      const data = await res.json()

      if (data?.id) {
        setForm({
          title: data.title ?? "",
          message: data.message ?? "",
          audience: data.audience ?? "all",
          country: data.country ?? null,
          locale: data.locale ?? null,
          teacher_id: data.teacher_id ?? null,
          active: data.active ?? true,
          expires_at: data.expires_at ? new Date(data.expires_at).toISOString().slice(0, 16) : null,
        })
      }
    })()
  }, [id, isEdit])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload = {
      ...form,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    }

    const res = await fetch(isEdit ? `/api/admin/notifications/${id}` : "/api/admin/notifications", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    setLoading(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Erro ao salvar")
      return
    }

    router.push("/portal/dashboard/admin/notifications")
  }

  return (
    <div className="p-6 text-white max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">{isEdit ? "Editar Notificação" : "Nova Notificação"}</h1>

      <form className="space-y-6" onSubmit={submit}>
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            className="bg-slate-800/50 border-slate-700 text-white"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            className="bg-slate-800/50 border-slate-700 text-white min-h-[160px]"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Audience</Label>
            <select
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
            >
              <option value="all">Todos</option>
              <option value="country">Por país</option>
              <option value="locale">Por idioma</option>
              <option value="teacher">Professor específico</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>País</Label>
            <select
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
              value={form.country ?? ""}
              onChange={(e) => setForm({ ...form, country: (e.target.value || null) as any })}
            >
              <option value="">—</option>
              <option value="BR">Brasil</option>
              <option value="UY">Uruguai</option>
              <option value="PY">Paraguai</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Idioma</Label>
            <select
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
              value={form.locale ?? ""}
              onChange={(e) => setForm({ ...form, locale: (e.target.value || null) as any })}
            >
              <option value="">—</option>
              <option value="pt-BR">pt-BR</option>
              <option value="es">es</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Professor ID (se audience=teacher)</Label>
            <Input
              className="bg-slate-800/50 border-slate-700 text-white"
              value={form.teacher_id ?? ""}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value || null })}
              placeholder="UUID do teacher"
            />
          </div>

          <div className="space-y-2">
            <Label>Expira em (opcional)</Label>
            <Input
              type="datetime-local"
              className="bg-slate-800/50 border-slate-700 text-white"
              value={form.expires_at ?? ""}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value || null })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-slate-200">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativa
        </label>

        <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 py-6" disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </div>
  )
}
