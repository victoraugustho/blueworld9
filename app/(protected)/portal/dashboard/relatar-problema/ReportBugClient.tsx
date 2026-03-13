"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Locale = "pt-BR" | "es"

export default function ReportBugClient({ locale }: { locale: Locale }) {
  const t = {
    title: locale === "es" ? "Reportar problema" : "Relatar problema",
    subtitle:
      locale === "es"
        ? "Describe el error o dificultad para que podamos ayudar"
        : "Descreva o erro ou dificuldade para podermos ajudar",
    titleLabel: locale === "es" ? "Titulo" : "Titulo",
    descLabel: locale === "es" ? "Descripcion" : "Descricao",
    urlLabel: locale === "es" ? "URL de la pagina (opcional)" : "URL da pagina (opcional)",
    send: locale === "es" ? "Enviar reporte" : "Enviar relato",
    sending: locale === "es" ? "Enviando..." : "Enviando...",
    success:
      locale === "es"
        ? "Reporte enviado. Gracias por avisarnos."
        : "Relato enviado. Obrigado por avisar.",
    error:
      locale === "es"
        ? "No fue posible enviar. Intenta de nuevo."
        : "Nao foi possivel enviar. Tente novamente.",
    placeholderTitle:
      locale === "es" ? "Ej: error al abrir materiales" : "Ex: erro ao abrir materiais",
    placeholderDesc:
      locale === "es"
        ? "Explica lo que paso, en que pantalla, y si ocurre siempre"
        : "Explique o que aconteceu, em qual tela e se ocorre sempre",
    placeholderUrl: locale === "es" ? "https://..." : "https://...",
  }

  const [form, setForm] = useState({
    title: "",
    description: "",
    page_url: "",
  })

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    if (typeof document === "undefined") return
    const ref = document.referrer || ""
    if (ref) {
      setForm((prev) => ({ ...prev, page_url: prev.page_url || ref }))
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setStatus("idle")

    try {
      const res = await fetch("/api/portal/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        setStatus("error")
        return
      }

      setStatus("success")
      setForm((prev) => ({ ...prev, title: "", description: "" }))
    } catch {
      setStatus("error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl bg-slate-900/20 backdrop-blur-xl border border-cyan-500/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            {t.title}
          </CardTitle>
          <p className="text-slate-300 text-sm mt-2">{t.subtitle}</p>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label className="text-white">{t.titleLabel}</Label>
              <Input
                placeholder={t.placeholderTitle}
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">{t.descLabel}</Label>
              <Textarea
                placeholder={t.placeholderDesc}
                className="bg-slate-800/50 border-slate-700 text-white min-h-[140px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">{t.urlLabel}</Label>
              <Input
                placeholder={t.placeholderUrl}
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.page_url}
                onChange={(e) => setForm({ ...form, page_url: e.target.value })}
              />
            </div>

            {status === "success" && <p className="text-emerald-300 text-sm">{t.success}</p>}
            {status === "error" && <p className="text-rose-300 text-sm">{t.error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 py-6"
            >
              {loading ? t.sending : t.send}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

