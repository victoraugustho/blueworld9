"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, Info, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  if (item.locale) return item.locale === "es" ? "es" : "pt-BR"
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
    if (count > 1) return `Professores selecionados: ${count}`
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

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

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

  const localeOrder: LocaleKey[] = ["pt-BR", "es", "geral"]
  const countryOrder: CountryKey[] = ["BR", "UY", "PY", "all"]

  const groups = useMemo(() => {
    const grouped: Record<LocaleKey, Record<CountryKey, NotificationItem[]>> = {
      "pt-BR": { BR: [], UY: [], PY: [], all: [] },
      es: { BR: [], UY: [], PY: [], all: [] },
      geral: { BR: [], UY: [], PY: [], all: [] },
    }

    for (const item of rows) {
      const lg = getLocaleGroup(item)
      const cg = getCountryGroup(item)
      grouped[lg][cg].push(item)
    }

    return grouped
  }, [rows])

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
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

      {loading ? <p className="text-slate-400">Carregando...</p> : null}
      {!loading && rows.length === 0 ? <p className="text-slate-400">Nenhuma notificacao.</p> : null}

      {!loading && rows.length > 0 ? (
        <div className="space-y-10">
          {localeOrder.map((localeKey) => {
            const localeGroup = groups[localeKey]
            const localeHasItems = countryOrder.some((countryKey) => localeGroup[countryKey].length > 0)
            if (!localeHasItems) return null

            return (
              <div key={localeKey}>
                <h2 className="text-2xl font-semibold text-cyan-300 mb-4">
                  {localeLabel(localeKey === "geral" ? null : localeKey)}
                </h2>

                <div className="space-y-6">
                  {countryOrder.map((countryKey) => {
                    const items = localeGroup[countryKey]
                    if (!items || items.length === 0) return null

                    return (
                      <div key={`${localeKey}-${countryKey}`}>
                        <h3 className="text-lg font-semibold text-slate-200 mb-3">
                          {countryLabel(countryKey === "all" ? null : countryKey)}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="p-5 rounded-xl bg-slate-800/40 border border-slate-700 backdrop-blur-xl"
                            >
                              <h3 className="text-lg font-semibold">{item.title}</h3>
                              <p className="text-slate-400 text-sm mt-1">
                                Publico: <b className="text-white">{audienceLabel(item)}</b> • {item.active ? "Ativa" : "Desativada"}
                              </p>
                              <p className="text-slate-500 text-xs mt-1">Formato: {typeLabel(item)}</p>
                              <p className="text-xs text-slate-500 mt-3">{new Date(item.created_at).toLocaleString("pt-BR")}</p>

                              <div className="flex flex-wrap gap-3 mt-4">
                                <Link href={`/portal/dashboard/admin/notifications/edit/${item.id}`}>
                                  <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                                    <Pencil className="w-4 h-4" /> Editar
                                  </Button>
                                </Link>
                                <Link href={`/portal/dashboard/admin/notifications/edit/${item.id}?tab=info`}>
                                  <Button className="bg-slate-700 hover:bg-slate-600 flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Informacoes
                                  </Button>
                                </Link>
                                <Button
                                  onClick={() => del(item.id)}
                                  className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" /> Excluir
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
