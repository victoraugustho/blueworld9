"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import type { Teacher } from "@/app/types/portal"

type TeachersGrouped = {
  approved: Teacher[]
  pending: Teacher[]
  disabled: Teacher[]
}

function countryLabel(c: Teacher["country"]) {
  if (c === "BR") return "Brasil"
  if (c === "UY") return "Uruguay"
  return "Paraguay"
}

function docLabel(t: Teacher) {
  if (t.document_type === "CPF") return "CPF"
  return "CI"
}

function localeBadge(locale: Teacher["locale"]) {
  return locale === "pt-BR"
    ? { label: "Português", cls: "bg-emerald-500/20 text-emerald-300" }
    : { label: "Español", cls: "bg-amber-500/20 text-amber-300" }
}

export default function AdminTeachersPage() {
  const [data, setData] = useState<TeachersGrouped>({
    approved: [],
    pending: [],
    disabled: [],
  })

  const [activeTab, setActiveTab] = useState<"approved" | "pending" | "disabled">("pending")
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/teachers", { cache: "no-store" })
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function approve(id: string) {
    await fetch(`/api/admin/teachers/${id}/approve`, { method: "PATCH" })
    load()
  }

  async function disable(id: string) {
    await fetch(`/api/admin/teachers/${id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    load()
  }

  async function enable(id: string) {
    await fetch(`/api/admin/teachers/${id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    load()
  }

  const teachers = data[activeTab]

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-8">Gerenciar Professores</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 flex-wrap">
        <Button className={activeTab === "pending" ? "bg-yellow-600" : "bg-white/10"} onClick={() => setActiveTab("pending")}>
          Pendentes ({data.pending.length})
        </Button>

        <Button className={activeTab === "approved" ? "bg-green-600" : "bg-white/10"} onClick={() => setActiveTab("approved")}>
          Aprovados ({data.approved.length})
        </Button>

        <Button className={activeTab === "disabled" ? "bg-red-600" : "bg-white/10"} onClick={() => setActiveTab("disabled")}>
          Desativados ({data.disabled.length})
        </Button>
      </div>

      {loading && <p className="text-slate-400">Carregando...</p>}

      {!loading && teachers.length === 0 && <p className="text-slate-400">Nenhum professor encontrado.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teachers.map((t) => {
          const badge = localeBadge(t.locale)
          return (
            <Card key={t.id} className="bg-white/10 backdrop-blur-xl border border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex flex-wrap items-center gap-2">
                  {t.name}

                  <span className="text-slate-300 text-xs bg-cyan-600/40 rounded-full px-3 py-1">
                    {countryLabel(t.country)}
                  </span>

                  <span className={`text-xs rounded-full px-3 py-1 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-slate-300 text-sm mb-2">
                  <b>Email:</b> {t.email}
                </p>
                <p className="text-slate-300 text-sm mb-2">
                  <b>Telefone:</b> {t.phone}
                </p>

                <p className="text-slate-300 text-sm mb-2">
                  <b>{docLabel(t)}:</b> {t.document_number}
                </p>

                {activeTab === "pending" && (
                  <span className="px-3 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs inline-block mb-4">
                    Pendente de aprovação
                  </span>
                )}

                {activeTab === "approved" && (
                  <span className="px-3 py-1 rounded bg-green-500/20 text-green-400 text-xs inline-block mb-4">
                    Aprovado
                  </span>
                )}

                {activeTab === "disabled" && (
                  <span className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-xs inline-block mb-4">
                    Desativado
                  </span>
                )}

                {/* Actions */}
                <div className="flex justify-between mt-4 gap-2">
                  <Link href={`/portal/dashboard/admin/teachers/${t.id}`}>
                    <Button className="bg-blue-600 hover:bg-blue-700">Editar</Button>
                  </Link>

                  {activeTab === "pending" && (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => approve(t.id)}>
                      Aprovar
                    </Button>
                  )}

                  {activeTab !== "disabled" ? (
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => disable(t.id)}>
                      Desativar
                    </Button>
                  ) : (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => enable(t.id)}>
                      Reativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
