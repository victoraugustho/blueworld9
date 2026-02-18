"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Info, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type N = {
  id: string
  title: string
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
  if (locale === "pt-BR") return "Português (BR)"
  if (locale === "es") return "Espanhol"
  return "Geral"
}

function countryLabel(country: string | null | undefined) {
  if (country === "BR") return "Brasil"
  if (country === "UY") return "Uruguai"
  if (country === "PY") return "Paraguai"
  return "Todos os países"
}

function mapLocaleFromCountry(country: string | null | undefined): LocaleKey {
  if (country === "BR") return "pt-BR"
  if (country === "UY" || country === "PY") return "es"
  return "geral"
}

function getLocaleGroup(n: N): LocaleKey {
  if (n.locale) return n.locale === "es" ? "es" : "pt-BR"
  if (n.country) return mapLocaleFromCountry(n.country)
  return "geral"
}

function getCountryGroup(n: N): CountryKey {
  if (n.country === "BR" || n.country === "UY" || n.country === "PY") return n.country
  return "all"
}

function shortId(id?: string | null) {
  if (!id) return ""
  return id.length > 10 ? `${id.slice(0, 8)}...` : id
}

function audienceLabel(n: N) {
  if (n.audience === "all") return "Todos"
  if (n.audience === "country") return `País: ${countryLabel(n.country)}`
  if (n.audience === "locale") return `Idioma: ${localeLabel(n.locale)}`
  if (n.audience === "teacher") {
    const ids = Array.isArray(n.teacher_ids) ? n.teacher_ids : []
    const count = ids.length || (n.teacher_id ? 1 : 0)
    if (count > 1) return `Professores selecionados: ${count}`
    const id = n.teacher_id ?? ids[0]
    return `Professor específico: ${shortId(id)}`
  }
  return "Todos"
}

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<N[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/notifications", { cache: "no-store" })
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function del(id: string) {
    if (!confirm("Excluir esta notificação?")) return
    const res = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" })
    if (res.ok) load()
  }

  const localeOrder: LocaleKey[] = ["pt-BR", "es", "geral"]
  const countryOrder: CountryKey[] = ["BR", "UY", "PY", "all"]

  const groups: Record<LocaleKey, Record<CountryKey, N[]>> = {
    "pt-BR": { BR: [], UY: [], PY: [], all: [] },
    es: { BR: [], UY: [], PY: [], all: [] },
    geral: { BR: [], UY: [], PY: [], all: [] },
  }

  for (const n of rows) {
    const lg = getLocaleGroup(n)
    const cg = getCountryGroup(n)
    groups[lg][cg].push(n)
  }

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="w-7 h-7 text-yellow-400" />
          {"Notificações (Admin)"}
        </h1>

        <Link href="/portal/dashboard/admin/notifications/new">
          <Button className="bg-cyan-600 hover:bg-cyan-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </Link>
      </div>

      {loading && <p className="text-slate-400">Carregando...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-slate-400">{"Nenhuma notificação."}</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-10">
          {localeOrder.map((localeKey) => {
            const localeGroup = groups[localeKey]
            const localeHasItems = countryOrder.some((c) => localeGroup[c].length > 0)
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
                          {items.map((n) => (
                            <div
                              key={n.id}
                              className="p-5 rounded-xl bg-slate-800/40 border border-slate-700 backdrop-blur-xl"
                            >
                              <h3 className="text-lg font-semibold">{n.title}</h3>
                              <p className="text-slate-400 text-sm mt-1">
                                Tipo: <b className="text-white">{audienceLabel(n)}</b> {"•"}{" "}
                                {n.active ? "Ativa" : "Desativada"}
                              </p>
                              <p className="text-xs text-slate-500 mt-3">
                                {new Date(n.created_at).toLocaleString("pt-BR")}
                              </p>

                              <div className="flex flex-wrap gap-3 mt-4">
                                <Link href={`/portal/dashboard/admin/notifications/edit/${n.id}`}>
                                  <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                                    <Pencil className="w-4 h-4" /> Editar
                                  </Button>
                                </Link>
                                <Link href={`/portal/dashboard/admin/notifications/edit/${n.id}?tab=info`}>
                                  <Button className="bg-slate-700 hover:bg-slate-600 flex items-center gap-2">
                                    <Info className="w-4 h-4" /> {"Informações"}
                                  </Button>
                                </Link>
                                <Button
                                  onClick={() => del(n.id)}
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
      )}
    </div>
  )
}
