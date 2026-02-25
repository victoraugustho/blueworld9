"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginBackground } from "@/components/login-background"
import { CheckCircle2, GraduationCap, KeyRound, Loader2, TriangleAlert } from "lucide-react"

type Locale = "pt-BR" | "es"

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") ?? ""

  const [locale, setLocale] = useState<Locale>("pt-BR")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = useMemo(() => {
    const isES = locale === "es"
    return {
      title: isES ? "Restablecer contraseña" : "Redefinir senha",
      subtitle: isES
        ? "Crea una contraseña nueva para tu cuenta."
        : "Crie uma nova senha para sua conta.",
      localeLabel: isES ? "Idioma" : "Idioma",
      pass: isES ? "Nueva contraseña" : "Nova senha",
      confirm: isES ? "Confirmar contraseña" : "Confirmar senha",
      save: isES ? "Guardar" : "Salvar",
      back: isES ? "Volver al login" : "Voltar ao login",
      success: isES ? "Contraseña actualizada ✅" : "Senha atualizada ✅",
      goLogin: isES ? "Ir al login" : "Ir para o login",
      errors: {
        noToken: isES ? "Token inválido. Vuelve a solicitar el enlace." : "Token inválido. Solicite o link novamente.",
        short: isES ? "La contraseña debe tener al menos 8 caracteres." : "A senha deve ter pelo menos 8 caracteres.",
        mismatch: isES ? "Las contraseñas no coinciden." : "As senhas não coincidem.",
        generic: isES ? "Error al actualizar la contraseña." : "Erro ao atualizar a senha.",
      },
    }
  }, [locale])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError(t.errors.noToken)
      return
    }
    if (password.length < 8) {
      setError(t.errors.short)
      return
    }
    if (password !== confirm) {
      setError(t.errors.mismatch)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/portal/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(data?.error ?? t.errors.generic))
        return
      }

      setDone(true)
      // opcional: redireciona sozinho após curto tempo
      // setTimeout(() => router.push("/"), 1500)
    } catch {
      setError(t.errors.generic)
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
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                {t.success}
              </div>

              <div className="mt-4 flex gap-2">
                <Link href="/" className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90">
                    {t.goLogin}
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {!token && (
                <div className="text-sm text-yellow-200 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
                  <TriangleAlert className="w-4 h-4 mt-0.5" />
                  {t.errors.noToken}
                </div>
              )}

              <div>
                <Label className="text-slate-200">{t.pass}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 bg-white/10 border-white/15 text-white"
                  disabled={loading}
                />
                <p className="text-xs text-slate-400 mt-2">
                  {locale === "es" ? "Mínimo 8 caracteres." : "Mínimo 8 caracteres."}
                </p>
              </div>

              <div>
                <Label className="text-slate-200">{t.confirm}</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-2 bg-white/10 border-white/15 text-white"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !token}
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
                    {t.save}
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
