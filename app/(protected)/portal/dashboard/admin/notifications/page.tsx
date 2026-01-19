"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"

type N = {
  id: string
  title: string
  audience: string
  active: boolean
  created_at: string
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

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="w-7 h-7 text-yellow-400" />
          Notificações (Admin)
        </h1>

        <Link href="/portal/dashboard/admin/notifications/new">
          <Button className="bg-cyan-600 hover:bg-cyan-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </Link>
      </div>

      {loading && <p className="text-slate-400">Carregando...</p>}
      {!loading && rows.length === 0 && <p className="text-slate-400">Nenhuma notificação.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rows.map((n) => (
          <div
            key={n.id}
            className="p-5 rounded-xl bg-slate-800/40 border border-slate-700 backdrop-blur-xl"
          >
            <h3 className="text-lg font-semibold">{n.title}</h3>
            <p className="text-slate-400 text-sm mt-1">
              Audience: <b className="text-white">{n.audience}</b> •{" "}
              {n.active ? "Ativa" : "Desativada"}
            </p>
            <p className="text-xs text-slate-500 mt-3">
              {new Date(n.created_at).toLocaleString("pt-BR")}
            </p>

            <div className="flex gap-3 mt-4">
              <Link href={`/portal/dashboard/admin/notifications/edit/${n.id}`}>
                <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> Editar
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
}
