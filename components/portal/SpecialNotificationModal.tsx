"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type SpecialNotification = {
  id: string
  title: string
  message: string
  special_mode: "once" | "until"
  created_at?: string | null
  expires_at?: string | null
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("pt-BR")
}

export default function SpecialNotificationModal() {
  const [item, setItem] = useState<SpecialNotification | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSpecialNotification() {
      const res = await fetch("/api/portal/special-notification", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (!cancelled && data?.id) {
        setItem(data)
      }
    }

    loadSpecialNotification()

    return () => {
      cancelled = true
    }
  }, [])

  async function dismiss() {
    if (!item) return
    setClosing(true)
    await fetch(`/api/portal/special-notification/${item.id}/dismiss`, {
      method: "POST",
    }).catch(() => null)
    setItem(null)
    setClosing(false)
  }

  if (!item) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar notificacao"
        onClick={dismiss}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-400/30 bg-slate-900/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-cyan-200/80">Notificacao especial</p>
            <h2 className="text-xl font-semibold text-white mt-1 flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-300" />
              <span className="truncate">{item.title}</span>
            </h2>
          </div>
          <Button
            type="button"
            onClick={dismiss}
            className="bg-white/10 hover:bg-white/20 border border-white/10"
            disabled={closing}
          >
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap break-words">{item.message}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">
              {item.special_mode === "once" ? "Exibe uma vez" : "Exibe ate o prazo"}
            </span>
            {item.created_at ? (
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">
                Criada em: {formatDateTime(item.created_at)}
              </span>
            ) : null}
            {item.expires_at ? (
              <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                Validade: {formatDateTime(item.expires_at)}
              </span>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={dismiss}
              className="bg-cyan-600 hover:bg-cyan-700"
              disabled={closing}
            >
              {closing ? "Fechando..." : "Entendi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
