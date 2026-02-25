"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginBackground } from "@/components/login-background"
import { User, Lock, Eye, EyeOff, GraduationCap, Globe, ArrowLeft, CheckCircle2 } from "lucide-react"
import Link from "next/link"

type Country = "BR" | "UY" | "PY"

const i18n = {
  "pt-BR": {
    title: "Portal do Professor",
    subtitle: "Acesse sua área exclusiva com documento e senha",
    formTitle: "Acesso ao Portal",
    formSubtitle: "Use seus dados para continuar",
    backHome: "Voltar ao site",
    country: "País",
    docCpf: "CPF",
    docCi: "Documento (CI)",
    password: "Senha",
    button: "Entrar no Portal",
    loading: "Entrando...",
    highlights: [
      "Acesso seguro para professores",
      "Materiais, aulas e turmas em um só lugar",
      "Atualizações e comunicados em tempo real",
    ],
    noAccount: "Ainda não tem cadastro?",
    signup: "Cadastre-se aqui",
    forgot: "Esqueci minha senha",
    errors: {
      required: "Documento e senha são obrigatórios",
      passMin: "Senha deve ter no mínimo 6 caracteres",
      cpfInvalid: "CPF inválido",
      docInvalid: "Documento inválido",
      notApproved: "Seu cadastro ainda não foi aprovado. Aguarde a análise.",
    },
    placeholders: {
      password: "Digite sua senha",
    },
  },
  es: {
    title: "Portal del Profesor",
    subtitle: "Accede con tu documento y contraseña",
    formTitle: "Acceso al Portal",
    formSubtitle: "Usa tus datos para continuar",
    backHome: "Volver al sitio",
    country: "País",
    docCpf: "CPF",
    docCi: "Documento (CI)",
    password: "Contraseña",
    button: "Entrar al Portal",
    loading: "Ingresando...",
    highlights: [
      "Acceso seguro para docentes",
      "Materiales, clases y grupos en un solo lugar",
      "Actualizaciones y avisos en tiempo real",
    ],
    noAccount: "¿Aún no tienes registro?",
    signup: "Regístrate aquí",
    forgot: "Olvidé mi contraseña",
    errors: {
      required: "Documento y contraseña son obligatorios",
      passMin: "La contraseña debe tener al menos 6 caracteres",
      cpfInvalid: "CPF inválido",
      docInvalid: "Documento inválido",
      notApproved: "Tu registro aún no fue aprobado. Espera la revisión.",
    },
    placeholders: {
      password: "Ingrese su contraseña",
    },
  },
} as const

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function formatCPF(value: string) {
  const numbers = onlyDigits(value)
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }
  return value
}

function validateCPF(cpf: string): boolean {
  const numbers = onlyDigits(cpf)
  if (numbers.length !== 11 || /^(\d)\1+$/.test(numbers)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(numbers[i]) * (10 - i)
  let digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== Number(numbers[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(numbers[i]) * (11 - i)
  digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== Number(numbers[10])) return false

  return true
}

function validateCI(doc: string) {
  const n = onlyDigits(doc)
  return n.length >= 6 && n.length <= 12
}

export default function PortalLoginPage() {
  const router = useRouter()

  const [country, setCountry] = useState<Country>("BR")
  const locale = useMemo(() => (country === "BR" ? "pt-BR" : "es"), [country])
  const t = i18n[locale]

  const [documentNumber, setDocumentNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const homeUrl = (process.env.NEXT_PUBLIC_DOMAIN_PRINCIPAL || process.env.NEXT_PUBLIC_SITE_URL || "/").trim()

  const docLabel = country === "BR" ? t.docCpf : t.docCi
  const docPlaceholder = country === "BR" ? "000.000.000-00" : "0000000"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!documentNumber || !password) {
      setError(t.errors.required)
      return
    }

    if (password.length < 6) {
      setError(t.errors.passMin)
      return
    }

    if (country === "BR") {
      if (!validateCPF(documentNumber)) {
        setError(t.errors.cpfInvalid)
        return
      }
    } else {
      if (!validateCI(documentNumber)) {
        setError(t.errors.docInvalid)
        return
      }
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          documentNumber: onlyDigits(documentNumber),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Erro ao fazer login")

      if (!data.approved) {
        setError(t.errors.notApproved)
        return
      }

      router.push("/portal/dashboard")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div data-auth-page className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <LoginBackground />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <a
            href={homeUrl}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200/90 backdrop-blur transition hover:border-cyan-300/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.backHome}
          </a>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
            {t.formSubtitle}
          </div>
        </div>

        <div className="grid flex-1 items-stretch gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-10 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/80 to-blue-600/80 shadow-lg shadow-cyan-500/30">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">BW9 Global</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">{t.title}</h1>
              </div>
            </div>

            <p className="mt-5 text-base text-slate-200/80">{t.subtitle}</p>

            <div className="mt-8 grid gap-3 text-sm text-slate-200/80">
              {t.highlights.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="relative w-full rounded-3xl border border-white/10 bg-slate-900/75 backdrop-blur-xl shadow-[0_24px_60px_-40px_rgba(8,145,178,0.7)]">
            <CardHeader className="space-y-2 pb-3">
              <CardTitle className="text-2xl font-semibold text-white">{t.formTitle}</CardTitle>
              <CardDescription className="text-slate-300">{t.formSubtitle}</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* País */}
                <div className="space-y-2">
                  <Label className="text-slate-200">{t.country}</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <select
                      value={country}
                      onChange={(e) => {
                        const c = e.target.value as Country
                        setCountry(c)
                        setDocumentNumber("")
                        setPassword("")
                        setError("")
                      }}
                      className="h-11 w-full rounded-md border border-white/10 bg-slate-900/60 pl-10 pr-3 text-sm text-white shadow-sm transition focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="BR">Brasil</option>
                      <option value="UY">Uruguay</option>
                      <option value="PY">Paraguay</option>
                    </select>
                  </div>
                </div>

                {/* Documento */}
                <div className="space-y-2">
                  <Label htmlFor="documentNumber" className="text-slate-200">
                    {docLabel}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <Input
                      id="documentNumber"
                      type="text"
                      placeholder={docPlaceholder}
                      value={documentNumber}
                      onChange={(e) =>
                        setDocumentNumber(country === "BR" ? formatCPF(e.target.value) : e.target.value)
                      }
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                    />
                  </div>
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">
                    {t.password}
                  </Label>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <Input
                      id="password"
                      type="password"
                      placeholder={t.placeholders.password}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 pr-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                      name="password" 
                      autoComplete="off"
                      onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Recuperar senha */}
                  <div className="flex justify-end pt-1">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-cyan-300 transition-colors hover:text-cyan-200 hover:underline"
                    >
                      {t.forgot}
                    </Link>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 w-full bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white transition hover:from-cyan-600 hover:to-blue-700"
                >
                  {isLoading ? t.loading : t.button}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-slate-400">
                    {t.noAccount}{" "}
                    <Link
                      href="/cadastro"
                      className="font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
                    >
                      {t.signup}
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
