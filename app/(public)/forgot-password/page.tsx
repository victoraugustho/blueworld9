"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginBackground } from "@/components/login-background"
import { GraduationCap, KeyRound, MailCheck, Loader2 } from "lucide-react"

type Country = "BR" | "UY" | "PY"
type Locale = "pt-BR" | "es"

export default function ForgotPasswordPage() {
  // Se quiser forçar por cookie no futuro, dá pra buscar do server.
  // Por enquanto, mantém o toggle simples e funcional:
  const [locale, setLocale] = useState<Locale>("pt-BR")
  const [country, setCountry] = useState<Country>("BR")
  const [documentNumber, setDocumentNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = useMemo(() => {
    const isES = locale === "es"
    return {
      title: isES ? "Recuperar contraseña" : "Recuperar senha",
      subtitle: isES
        ? "Ingresa tu documento. Si existe una cuenta, enviaremos un enlace al email registrado."
        : "Informe seu documento. Se existir uma conta, enviaremos um link para o email cadastrado.",
      country: isES ? "País" : "País",
      doc: isES ? "Documento" : "Documento",
      docPlaceholder: isES ? "Solo números" : "Apenas números",
      send: isES ? "Enviar enlace" : "Enviar link",
      back: isES ? "Volver al login" : "Voltar ao login",
      successTitle: isES ? "Listo ✅" : "Pronto ✅",
      successText: isES
        ? "Si existe una cuenta con esos datos, revisa tu email (y spam) para continuar."
        : "Se existir uma conta com esses dados, verifique seu email (e spam) para continuar.",
      tryAgain: isES ? "Enviar de nuevo" : "Enviar novamente",
      localeLabel: isES ? "Idioma" : "Idioma",
      errors: {
        required: isES ? "Completa el país y el documento." : "Preencha país e documento.",
        generic: isES ? "Error al solicitar el enlace." : "Erro ao solicitar o link.",
      },
    }
  }, [locale])

  function onlyDigits(v: string) {
    return (v ?? "").replace(/\D/g, "")
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const doc = onlyDigits(documentNumber)
    if (!country || !doc) {
      setError(t.errors.required)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/portal/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, documentNumber: doc }),
      })

      // Mesmo se der erro, a API pode responder ok genérico. Aqui:
      if (!res.ok) throw new Error("not_ok")

      setDone(true)
    } catch {
      setError(t.errors.generic)
      setDone(true) // mantém comportamento "sem vazamento"
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <LoginBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-lg bg-slate-900/40 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">{t.title}</CardTitle>
              <CardDescription className="text-slate-300">{t.subtitle}</CardDescription>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">{t.localeLabel}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLocale("pt-BR")}
                className={`px-3 py-1 rounded-lg text-xs border transition ${
                  locale === "pt-BR"
                    ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-200"
                    : "bg-transparent border-white/10 text-white/70 hover:bg-white/5"
                }`}
              >
                pt-BR
              </button>
              <button
                type="button"
                onClick={() => setLocale("es")}
                className={`px-3 py-1 rounded-lg text-xs border transition ${
                  locale === "es"
                    ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-200"
                    : "bg-transparent border-white/10 text-white/70 hover:bg-white/5"
                }`}
              >
                es
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {done ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white">
              <div className="flex items-center gap-2 font-semibold">
                <MailCheck className="w-5 h-5 text-green-300" />
                {t.successTitle}
              </div>
              <p className="text-sm text-slate-300 mt-2">{t.successText}</p>

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setDone(false)
                    setError(null)
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
                >
                  {t.tryAgain}
                </Button>

                <Link href="/" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent border-white/15 text-white hover:bg-white/5"
                  >
                    {t.back}
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label className="text-slate-200">{t.country}</Label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as Country)}
                    className="mt-2 w-full rounded-xl bg-white/10 border border-white/15 text-white px-3 py-2 outline-none"
                  >
                    <div className="text-black">
                        <option value="BR">Brasil</option>
                        <option value="UY">Uruguay</option>
                        <option value="PY">Paraguay</option>
                    </div>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-slate-200">{t.doc}</Label>
                  <Input
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder={t.docPlaceholder}
                    className="mt-2 bg-white/10 border-white/15 text-white"
                    inputMode="numeric"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" />
                    {t.send}
                  </>
                )}
              </Button>

              <Link href="/" className="block">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-transparent border-white/15 text-white hover:bg-white/5"
                >
                  {t.back}
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  )
}
