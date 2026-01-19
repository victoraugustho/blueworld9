"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell, CheckCircle2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"

type NotificationRow = {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  read_at?: string | null
}

type Locale = "pt-BR" | "es"

function getCookie(name: string) {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return match ? decodeURIComponent(match[2]) : null
}

export default function NotificacoesPage() {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const locale: Locale = (getCookie("portal_locale") as Locale) === "es" ? "es" : "pt-BR"

  const t = {
    title: locale === "es" ? "Notificaciones" : "Notificações",
    loading: locale === "es" ? "Cargando..." : "Carregando...",
    empty: locale === "es" ? "No hay notificaciones." : "Nenhuma notificação.",
    unread: (n: number) =>
      locale === "es" ? `${n} sin leer` : `${n} não lida(s)`,
    allGood: locale === "es" ? "¡Estás al día 🙂" : "Você está em dia 🙂",
    markRead: locale === "es" ? "Marcar como leída" : "Marcar como lida",
    markUnread: locale === "es" ? "Marcar como no leída" : "Marcar como não lida",
  }

  async function load() {
    setLoading(true)
    const res = await fetch("/api/portal/notifications", { cache: "no-store" })
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const unreadCount = useMemo(() => rows.filter((r) => !r.is_read).length, [rows])

  async function markRead(id: string) {
    await fetch(`/api/portal/notifications/${id}/read`, { method: "POST" })
    load()
  }

  async function markUnread(id: string) {
    await fetch(`/api/portal/notifications/${id}/read`, { method: "DELETE" })
    load()
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString(locale === "es" ? "es-ES" : "pt-BR")
    } catch {
      return iso
    }
  }

  return (
    <div className="text-white p-6">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
        <Bell className="w-7 h-7 text-yellow-400" />
        {t.title}
      </h1>

      <p className="text-slate-400 mb-6">
        {unreadCount > 0 ? t.unread(unreadCount) : t.allGood}
      </p>

      {loading && <p className="text-slate-400">{t.loading}</p>}
      {!loading && rows.length === 0 && <p className="text-slate-400">{t.empty}</p>}

      <div className="space-y-4">
        {rows.map((n) => (
          <div
            key={n.id}
            className={`p-5 rounded-xl border backdrop-blur-xl shadow-lg ${
              n.is_read ? "bg-slate-800/30 border-slate-700" : "bg-yellow-500/10 border-yellow-500/20"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {n.is_read ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-yellow-400" />
                  )}
                  <h3 className="text-lg font-semibold text-white">{n.title}</h3>
                </div>

                <p className="text-slate-300 mt-2 whitespace-pre-wrap">{n.message}</p>

                <p className="text-xs text-slate-500 mt-3">
                  {formatDate(n.created_at)}
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-2">
                {!n.is_read ? (
                  <Button onClick={() => markRead(n.id)} className="bg-green-600 hover:bg-green-700">
                    {t.markRead}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => markUnread(n.id)}
                    className="bg-transparent border-white/20 text-white"
                  >
                    {t.markUnread}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
