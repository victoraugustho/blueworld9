"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog"
import type { Teacher } from "@/app/types/portal"
import {
  Search,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageCircle,
  CheckCircle2,
  Ban,
  RotateCcw,
  RefreshCcw,
} from "lucide-react"

type TeachersGrouped = {
  approved: Teacher[]
  pending: Teacher[]
  disabled: Teacher[]
}

type Tab = "approved" | "pending" | "disabled"
type Country = Teacher["country"]

function countryLabel(c: Country) {
  if (c === "BR") return "Brasil"
  if (c === "UY") return "Uruguai"
  return "Paraguai"
}

function docLabel(t: Teacher) {
  if (t.document_type === "CPF") return "CPF"
  return "CI"
}

function normalize(v: any) {
  return String(v ?? "").trim().toLowerCase()
}

function groupByCountry(list: Teacher[]) {
  const groups: Record<string, Teacher[]> = { BR: [], UY: [], PY: [] }
  for (const t of list) {
    const key = (t.country as string) || "BR"
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups as Record<Country, Teacher[]>
}

function maskPhone(phone?: string) {
  const p = String(phone ?? "").replace(/\D/g, "")
  if (p.length < 10) return phone ?? "-"
  const ddd = p.slice(0, 2)
  const mid = p.length === 11 ? p.slice(2, 7) : p.slice(2, 6)
  const end = p.length === 11 ? p.slice(7) : p.slice(6)
  return `(${ddd}) ${mid}-${end}`
}

function getWhatsAppNumber(phone: string | null | undefined, country: Country) {
  const digits = String(phone ?? "").replace(/\D/g, "")
  if (!digits) return null

  const prefixes: Record<string, string> = {
    BR: "55",
    UY: "598",
    PY: "595",
  }

  const prefix = prefixes[country || "BR"] ?? "55"
  let local = digits.replace(/^0+/, "")

  if (local.startsWith(prefix)) {
    return local
  }

  return `${prefix}${local}`
}

function whatsappHref(phone: string | null | undefined, country: Country, name?: string | null) {
  const num = getWhatsAppNumber(phone, country)
  if (!num) return null
  const msg = encodeURIComponent(`Olá, ${name || "professor(a)"}.`) 
  return `https://wa.me/${num}?text=${msg}`
}

function IconButton({
  title,
  onClick,
  children,
  className = "",
  disabled,
}: {
  title: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        w-9 h-9 rounded-xl
        border transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  )
}

export default function AdminTeachersPage() {
  const [data, setData] = useState<TeachersGrouped>({ approved: [], pending: [], disabled: [] })
  const [activeTab, setActiveTab] = useState<Tab>("approved")
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState("")

  const [openCountries, setOpenCountries] = useState<Record<Country, boolean>>({
    BR: true,
    UY: true,
    PY: true,
  })
  const { confirm, confirmDialog } = useConfirmDialog()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" })
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function approve(teacher: Teacher) {
    const ok = await confirm({
      title: "Aprovar professor",
      description: `Confirma a aprovação do acesso de ${teacher.name}?`,
      confirmText: "Aprovar",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/teachers/${teacher.id}/approve`, { method: "PATCH" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data?.error ?? "Não foi possível aprovar o professor.")
      return
    }
    await load()
  }

  async function disable(teacher: Teacher) {
    const ok = await confirm({
      title: "Desativar professor",
      description: `Tem certeza que deseja desativar o acesso de ${teacher.name}? O professor não poderá entrar no portal até ser reativado.`,
      confirmText: "Desativar",
      variant: "danger",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/teachers/${teacher.id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data?.error ?? "Não foi possível desativar o professor.")
      return
    }
    await load()
  }

  async function enable(teacher: Teacher) {
    const ok = await confirm({
      title: "Reativar professor",
      description: `Confirma a reativação do acesso de ${teacher.name}?`,
      confirmText: "Reativar",
    })
    if (!ok) return

    const res = await fetch(`/api/admin/teachers/${teacher.id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data?.error ?? "Não foi possível reativar o professor.")
      return
    }
    await load()
  }

  const teachersRaw = data[activeTab] ?? []

  const teachers = useMemo(() => {
    const q = normalize(query)
    const filtered =
      !q
        ? teachersRaw
        : teachersRaw.filter((t) => {
            const hay = [
              t.id,
              t.name,
              t.email,
              t.phone,
              t.country,
              t.locale,
              t.document_type,
              t.document_number,
            ]
              .map(normalize)
              .join(" | ")

            return hay.includes(q)
          })

    return [...filtered].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR", { sensitivity: "base" })
    )
  }, [teachersRaw, query])

  const grouped = useMemo(() => groupByCountry(teachers), [teachers])

  const counts = useMemo(
    () => ({
      pending: data.pending.length,
      approved: data.approved.length,
      disabled: data.disabled.length,
    }),
    [data]
  )

  function toggleCountry(c: Country) {
    setOpenCountries((prev) => ({ ...prev, [c]: !prev[c] }))
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 text-white">
      <div className="mb-6 sm:mb-8 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Professores</h1>
            <p className="text-slate-300 mt-1 text-sm sm:text-base">
              Pesquise, organize por país e veja detalhes na página do professor.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              className={activeTab === "pending" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-white/10 hover:bg-white/15"}
              onClick={() => setActiveTab("pending")}
            >
              Pendentes ({counts.pending})
            </Button>

            <Button
              className={activeTab === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-white/10 hover:bg-white/15"}
              onClick={() => setActiveTab("approved")}
            >
              Aprovados ({counts.approved})
            </Button>

            <Button
              className={activeTab === "disabled" ? "bg-red-600 hover:bg-red-700" : "bg-white/10 hover:bg-white/15"}
              onClick={() => setActiveTab("disabled")}
            >
              Desativados ({counts.disabled})
            </Button>
          </div>

          <Button
            onClick={load}
            disabled={loading}
            className="sm:ml-auto bg-white/10 hover:bg-white/15 border border-white/10"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-full relative">
            <Search className="w-4 h-4 text-white/80 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar nome, email, telefone ou documento..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/80 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="text-slate-400">Carregando...</p>}

      {!loading && teachers.length === 0 && (
        <p className="text-slate-400">Nenhum professor encontrado neste filtro.</p>
      )}

      {!loading && teachers.length > 0 && (
        <div className="space-y-10">
          {(["BR", "UY", "PY"] as Country[]).map((c) => {
            const list = grouped[c] ?? []
            const open = openCountries[c]
            if (list.length === 0) return null

            return (
              <section key={c} className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => toggleCountry(c)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="text-base sm:text-lg font-semibold">{countryLabel(c)}</span>
                    <span className="text-xs text-white/80 border border-white/10 rounded-full px-2 py-1">
                      {list.length}
                    </span>
                    {open ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                  </button>
                </div>

                {open && (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur">
                    <div className="hidden lg:grid grid-cols-[minmax(0,1.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-3 px-4 py-3 text-[11px] uppercase tracking-wide text-slate-300 border-b border-white/10 bg-white/5">
                      <span>Professor</span>
                      <span>Contato</span>
                      <span>Documento</span>
                      <span className="text-right">Ações</span>
                    </div>

                    {list.map((t) => {
                      const wa = whatsappHref(t.phone, t.country, t.name)

                      return (
                        <div
                          key={t.id}
                          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-3 px-4 py-4 border-b border-white/10 last:border-b-0 hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/portal/dashboard/admin/teachers/${t.id}/info`}
                              className="text-sm sm:text-base font-semibold text-white hover:text-cyan-200 truncate block"
                            >
                              {t.name}
                            </Link>
                            <p className="text-xs text-white/60 truncate">{t.email}</p>
                          </div>

                          <div className="text-xs text-white/80 space-y-2">
                            <p className="truncate">
                              <span className="text-slate-400">Telefone:</span> {maskPhone(t.phone)}
                            </p>
                          </div>

                          <div className="text-xs text-white/80 space-y-1">
                            <p className="truncate">
                              <span className="text-slate-400">{docLabel(t)}:</span> {t.document_number || "-"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 lg:justify-end">
                            <IconButton
                              title="Copiar ID"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(t.id)
                                } catch {}
                              }}
                              className="border-white/30 bg-white/10 hover:bg-white/15 text-white"
                            >
                              <Copy className="w-4 h-4 text-white/70" />
                            </IconButton>

                            {wa ? (
                              <a href={wa} target="_blank" rel="noopener noreferrer" title="Enviar mensagem no WhatsApp">
                                <span className="inline-flex">
                                  <IconButton
                                    title="Enviar mensagem no WhatsApp"
                                    className="border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </IconButton>
                                </span>
                              </a>
                            ) : null}

                            <Link href={`/portal/dashboard/admin/teachers/${t.id}/info`} title="Gerenciar professor">
                              <span className="inline-flex">
                                <IconButton
                                  title="Gerenciar professor"
                                  className="border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-200"
                                >
                                  <Info className="w-4 h-4" />
                                </IconButton>
                              </span>
                            </Link>

                            {activeTab === "pending" && (
                              <IconButton
                                title="Aprovar"
                                onClick={() => approve(t)}
                                className="border-green-500/20 bg-green-500/10 hover:bg-green-500/15 text-green-200"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </IconButton>
                            )}

                            {activeTab !== "disabled" ? (
                              <IconButton
                                title="Desativar"
                                onClick={() => disable(t)}
                                className="border-red-500/20 bg-red-500/10 hover:bg-red-500/15 text-red-200"
                              >
                                <Ban className="w-4 h-4" />
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Reativar"
                                onClick={() => enable(t)}
                                className="border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </IconButton>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
