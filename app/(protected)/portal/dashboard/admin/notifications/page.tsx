"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, Info, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type NotificationItem = {
  id: string
  title: string
  type?: "standard" | "special_modal"
  special_mode?: "once" | "until" | null
  audience: "all" | "country" | "locale" | "teacher"
  active: boolean
  created_at: string
  country?: "BR" | "UY" | "PY" | null
  locale?: "pt-BR" | "es" | null
  teacher_id?: string | null
  teacher_ids?: string[] | null
}

type LocaleKey = "pt-BR" | "es" | "geral"
type CountryKey = "BR" | "UY" | "PY" | "all"

function localeLabel(locale: string | null | undefined) {
  if (locale === "pt-BR") return "Portugues (BR)"
  if (locale === "es") return "Espanhol"
  return "Geral"
}

function countryLabel(country: string | null | undefined) {
  if (country === "BR") return "Brasil"
  if (country === "UY") return "Uruguai"
  if (country === "PY") return "Paraguai"
  return "Todos os paises"
}

function mapLocaleFromCountry(country: string | null | undefined): LocaleKey {
  if (country === "BR") return "pt-BR"
  if (country === "UY" || country === "PY") return "es"
  return "geral"
}

function getLocaleGroup(item: NotificationItem): LocaleKey {
  if (item.locale === "pt-BR" || item.locale === "es") return item.locale
  if (item.country) return mapLocaleFromCountry(item.country)
  return "geral"
}

function getCountryGroup(item: NotificationItem): CountryKey {
  if (item.country === "BR" || item.country === "UY" || item.country === "PY") return item.country
  return "all"
}

function shortId(id?: string | null) {
  if (!id) return ""
  return id.length > 10 ? `${id.slice(0, 8)}...` : id
}

function audienceLabel(item: NotificationItem) {
  if (item.audience === "all") return "Todos"
  if (item.audience === "country") return `Pais: ${countryLabel(item.country)}`
  if (item.audience === "locale") return `Idioma: ${localeLabel(item.locale)}`
  if (item.audience === "teacher") {
    const ids = Array.isArray(item.teacher_ids) ? item.teacher_ids : []
    const count = ids.length || (item.teacher_id ? 1 : 0)
    if (count > 1) return `Professores: ${count}`
    const id = item.teacher_id ?? ids[0]
    return `Professor: ${shortId(id)}`
  }
  return "Todos"
}

function typeLabel(item: NotificationItem) {
  if (item.type === "special_modal") {
    return item.special_mode === "until" ? "Especial (ate expirar)" : "Especial (uma vez)"
  }
  return "Padrao"
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR")
  } catch {
    return value
  }
}

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [localeFilter, setLocaleFilter] = useState<"all" | LocaleKey>("all")
  const [countryFilter, setCountryFilter] = useState<"all" | CountryKey>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "standard" | "special_modal">("all")

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/notifications", { cache: "no-store" })
    const data = await res.json().catch(() => [])
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function del(id: string) {
    if (!confirm("Excluir esta notificacao?")) return
    const res = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" })
    if (res.ok) load()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Nao foi possivel excluir.")
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()

    return rows.filter((item) => {
      if (status === "active" && !item.active) return false
      if (status === "inactive" && item.active) return false
      if (typeFilter !== "all" && (item.type ?? "standard") !== typeFilter) return false
      if (localeFilter !== "all" && getLocaleGroup(item) !== localeFilter) return false
      if (countryFilter !== "all" && getCountryGroup(item) !== countryFilter) return false
      if (!q) return true

      const searchable = [
        item.title,
        audienceLabel(item),
        typeLabel(item),
        localeLabel(getLocaleGroup(item)),
        countryLabel(getCountryGroup(item)),
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(q)
    })
  }, [rows, query, status, typeFilter, localeFilter, countryFilter])

  return (
    <div className="p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="w-7 h-7 text-yellow-400" />
          Notificacoes (Admin)
        </h1>

        <Link href="/portal/dashboard/admin/notifications/new">
          <Button className="bg-cyan-600 hover:bg-cyan-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/30 backdrop-blur p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por titulo, publico ou tipo..."
            className="bg-slate-900/60 border-white/10 text-white md:col-span-2"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-10 rounded-md bg-slate-900/60 border border-white/10 px-3 text-white"
          >
            <option className="text-black" value="all">Todos os status</option>
            <option className="text-black" value="active">Ativas</option>
            <option className="text-black" value="inactive">Desativadas</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            className="h-10 rounded-md bg-slate-900/60 border border-white/10 px-3 text-white"
          >
            <option className="text-black" value="all">Todos os formatos</option>
            <option className="text-black" value="standard">Padrao</option>
            <option className="text-black" value="special_modal">Especial</option>
          </select>

          <select
            value={localeFilter}
            onChange={(event) => setLocaleFilter(event.target.value as typeof localeFilter)}
            className="h-10 rounded-md bg-slate-900/60 border border-white/10 px-3 text-white"
          >
            <option className="text-black" value="all">Todos os idiomas</option>
            <option className="text-black" value="pt-BR">Portugues (BR)</option>
            <option className="text-black" value="es">Espanhol</option>
            <option className="text-black" value="geral">Geral</option>
          </select>

          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value as typeof countryFilter)}
            className="h-10 rounded-md bg-slate-900/60 border border-white/10 px-3 text-white md:col-start-5"
          >
            <option className="text-black" value="all">Todos os paises</option>
            <option className="text-black" value="BR">Brasil</option>
            <option className="text-black" value="UY">Uruguai</option>
            <option className="text-black" value="PY">Paraguai</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-slate-400 mb-3">
        {loading ? "Carregando..." : `${filteredRows.length} notificacao(oes) encontradas`}
      </div>

      {!loading && filteredRows.length === 0 ? (
        <p className="text-slate-400">Nenhuma notificacao encontrada.</p>
      ) : null}

      {!loading && filteredRows.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-900/25 backdrop-blur overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-200">
                <th className="text-left px-4 py-3 font-semibold">Titulo</th>
                <th className="text-left px-3 py-3 font-semibold">Publico</th>
                <th className="text-left px-3 py-3 font-semibold">Formato</th>
                <th className="text-left px-3 py-3 font-semibold">Idioma</th>
                <th className="text-left px-3 py-3 font-semibold">Pais</th>
                <th className="text-left px-3 py-3 font-semibold">Status</th>
                <th className="text-left px-3 py-3 font-semibold">Criacao</th>
                <th className="text-left px-4 py-3 font-semibold">Acoes</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((item) => {
                const locale = getLocaleGroup(item)
                const country = getCountryGroup(item)
                return (
                  <tr key={item.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-white line-clamp-1">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-1">ID: {shortId(item.id)}</p>
                    </td>

                    <td className="px-3 py-3 align-top text-slate-200">{audienceLabel(item)}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{typeLabel(item)}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{localeLabel(locale)}</td>
                    <td className="px-3 py-3 align-top text-slate-200">{countryLabel(country)}</td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                          item.active
                            ? "border-emerald-300/35 bg-emerald-500/20 text-emerald-100"
                            : "border-rose-300/35 bg-rose-500/20 text-rose-100"
                        }`}
                      >
                        {item.active ? "Ativa" : "Desativada"}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-slate-300 whitespace-nowrap">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <Link href={`/portal/dashboard/admin/notifications/edit/${item.id}`}>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/portal/dashboard/admin/notifications/edit/${item.id}?tab=info`}>
                          <Button size="sm" className="bg-slate-700 hover:bg-slate-600">
                            <Info className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => del(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

