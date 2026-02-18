"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { Teacher } from "@/app/types/portal"

type N = {
  title: string
  message: string
  audience: "all" | "country" | "locale" | "teacher"
  country?: "BR" | "UY" | "PY" | null
  locale?: "pt-BR" | "es" | null
  teacher_id?: string | null
  teacher_ids?: string[] | null
  active: boolean
  expires_at?: string | null
}

type ReadRow = {
  id: string
  name: string
  email: string
  country: string
  locale: string
  is_read: boolean
  read_at?: string | null
}

type ReadSummary = {
  total: number
  read: number
  unread: number
  teachers: ReadRow[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return ""
  try {
    return new Date(value).toLocaleString("pt-BR")
  } catch {
    return value
  }
}

export default function NotificationForm({ id }: { id?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEdit = Boolean(id)

  const [tab, setTab] = useState<"edit" | "info">("edit")
  const [form, setForm] = useState<N>({
    title: "",
    message: "",
    audience: "all",
    country: null,
    locale: null,
    teacher_id: null,
    teacher_ids: [],
    active: true,
    expires_at: null,
  })

  const [loading, setLoading] = useState(false)
  const [reads, setReads] = useState<ReadSummary | null>(null)
  const [readsLoading, setReadsLoading] = useState(false)
  const [readsQuery, setReadsQuery] = useState("")
  const [readsFilter, setReadsFilter] = useState<"all" | "read" | "unread">("all")
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherQuery, setTeacherQuery] = useState("")

  const selectedTeacherIds = form.teacher_ids ?? []
  const teacherMode = selectedTeacherIds.length > 0

  useEffect(() => {
    if (!isEdit) return
    const t = searchParams?.get("tab")
    if (t === "info") setTab("info")
    if (t === "edit") setTab("edit")
  }, [isEdit, searchParams])

  useEffect(() => {
    if (!isEdit || !id) return

    ;(async () => {
      const res = await fetch(`/api/admin/notifications/${id}`, { cache: "no-store" })
      const data = await res.json()

      if (data?.id) {
        const ids =
          Array.isArray(data.teacher_ids) && data.teacher_ids.length > 0
            ? data.teacher_ids
            : data.teacher_id
              ? [data.teacher_id]
              : []
        setForm({
          title: data.title ?? "",
          message: data.message ?? "",
          audience: data.audience ?? "all",
          country: data.country ?? null,
          locale: data.locale ?? null,
          teacher_id: data.teacher_id ?? null,
          teacher_ids: ids,
          active: data.active ?? true,
          expires_at: data.expires_at ? new Date(data.expires_at).toISOString().slice(0, 16) : null,
        })
      }
    })()
  }, [id, isEdit])

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" })
      const data = await res.json()
      const list = Array.isArray(data?.approved) ? data.approved : []
      list.sort((a: Teacher, b: Teacher) => a.name.localeCompare(b.name))
      setTeachers(list)
    })()
  }, [])

  async function loadReads() {
    if (!id) return
    setReadsLoading(true)
    const res = await fetch(`/api/admin/notifications/${id}/reads`, { cache: "no-store" })
    const data = await res.json()
    setReads(data ?? null)
    setReadsLoading(false)
  }

  useEffect(() => {
    if (!isEdit || !id) return
    loadReads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit])

  const filteredReads = useMemo(() => {
    if (!reads?.teachers) return []
    const q = readsQuery.trim().toLowerCase()
    return reads.teachers.filter((t) => {
      if (readsFilter === "read" && !t.is_read) return false
      if (readsFilter === "unread" && t.is_read) return false
      if (!q) return true
      const hay = `${t.name} ${t.email}`.toLowerCase()
      return hay.includes(q)
    })
  }, [reads, readsFilter, readsQuery])

  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter((t) => {
      const hay = `${t.name} ${t.email}`.toLowerCase()
      return hay.includes(q)
    })
  }, [teacherQuery, teachers])

  function toggleTeacher(id: string) {
    setForm((prev) => {
      const current = new Set(prev.teacher_ids ?? [])
      if (current.has(id)) current.delete(id)
      else current.add(id)
      const nextIds = Array.from(current)
      return {
        ...prev,
        teacher_ids: nextIds,
        teacher_id: nextIds[0] ?? null,
        audience: nextIds.length > 0 ? "teacher" : prev.audience,
        country: nextIds.length > 0 ? null : prev.country,
        locale: nextIds.length > 0 ? null : prev.locale,
      }
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const teacher_ids = (form.teacher_ids ?? []).filter(Boolean)
    const payload = {
      ...form,
      teacher_ids,
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

      {isEdit && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`px-3 py-1.5 rounded-full text-xs border transition ${
              tab === "edit"
                ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            {"Edição"}
          </button>
          <button
            type="button"
            onClick={() => setTab("info")}
            className={`px-3 py-1.5 rounded-full text-xs border transition ${
              tab === "info"
                ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            }`}
          >
            {"Informações"}
          </button>
        </div>
      )}

      {(!isEdit || tab === "edit") && (
        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-2">
            <Label>{"Título"}</Label>
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
                onChange={(e) => {
                  const value = e.target.value as N["audience"]
                  setForm((prev) => ({
                    ...prev,
                    audience: value,
                    teacher_ids: value === "teacher" ? prev.teacher_ids ?? [] : [],
                    teacher_id: value === "teacher" ? prev.teacher_id : null,
                    country: value === "country" ? prev.country : null,
                    locale: value === "locale" ? prev.locale : null,
                  }))
                }}
                disabled={teacherMode}
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
                disabled={teacherMode || form.audience === "teacher"}
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
                disabled={teacherMode || form.audience === "teacher"}
              >
                <option value="">—</option>
                <option value="pt-BR">pt-BR</option>
                <option value="es">es</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Professores (envio específico)</Label>
              <Input
                className="bg-slate-800/50 border-slate-700 text-white"
                placeholder="Buscar professor..."
                value={teacherQuery}
                onChange={(e) => setTeacherQuery(e.target.value)}
              />
              <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/40">
                {filteredTeachers.length === 0 && (
                  <div className="p-3 text-sm text-slate-400">Nenhum professor encontrado.</div>
                )}
                {filteredTeachers.map((teacher) => {
                  const checked = selectedTeacherIds.includes(teacher.id)
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
                        <div className="text-[11px] text-slate-500">
                          {teacher.country} • {teacher.locale}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                <span>Selecionados: {selectedTeacherIds.length}</span>
                {selectedTeacherIds.length > 0 && (
                  <button
                    type="button"
                    className="text-cyan-300 hover:text-cyan-200"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        teacher_ids: [],
                        teacher_id: null,
                      }))
                    }
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              {selectedTeacherIds.length > 0 && (
                <p className="text-xs text-amber-300 mt-1">
                  Audience definido para professor específico. País e idioma foram desativados.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
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
      )}

      {isEdit && tab === "info" && (
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Leituras</h2>
              <p className="text-xs text-slate-400">
                {reads?.read ?? 0}
                {" lidas • "}
                {reads?.unread ?? 0}
                {" não lidas • "}
                {reads?.total ?? 0}
                {" total"}
              </p>
            </div>
            <Button
              type="button"
              onClick={loadReads}
              className="bg-slate-800/60 border border-white/10 hover:bg-white/10"
            >
              Atualizar
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <Input
              className="bg-slate-800/50 border-slate-700 text-white"
              placeholder="Buscar por nome ou email..."
              value={readsQuery}
              onChange={(e) => setReadsQuery(e.target.value)}
            />
            <select
              className="w-full md:w-40 p-2 rounded bg-slate-800 border border-slate-700 text-white"
              value={readsFilter}
              onChange={(e) => setReadsFilter(e.target.value as any)}
            >
              <option value="all">Todas</option>
              <option value="read">Lidas</option>
              <option value="unread">{"Não lidas"}</option>
            </select>
          </div>

          {readsLoading && <p className="text-slate-400">Carregando leituras...</p>}

          {!readsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReads.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{t.name}</div>
                      <div className="text-xs text-slate-400">{t.email}</div>
                      <div className="text-xs text-slate-500">
                        {t.country} {"•"} {t.locale}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        t.is_read
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      }`}
                    >
                      {t.is_read ? "Lida" : "Não lida"}
                    </span>
                  </div>
                  {t.is_read && (
                    <div className="text-xs text-slate-400 mt-2">
                      Lida em: {formatDate(t.read_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
