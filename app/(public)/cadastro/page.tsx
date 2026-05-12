"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginBackground } from "@/components/login-background"
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  CheckCircle,
  CheckCircle2,
  Globe,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"

type Country = "BR" | "UY" | "PY"

const i18n = {
  "pt-BR": {
    title: "Cadastro de Professor",
    subtitle: "Preencha seus dados para solicitar acesso ao portal",
    formTitle: "Solicitação de Cadastro",
    formSubtitle: "Complete seus dados para continuar",
    backHome: "Voltar ao site",
    name: "Nome Completo",
    email: "E-mail",
    phone: "Telefone",
    country: "País",
    docCpf: "CPF",
    docCi: "Documento (CI)",
    password: "Senha",
    confirmPassword: "Confirmar Senha",
    submit: "Solicitar Cadastro",
    submitting: "Cadastrando...",
    highlights: [
      "Solicitação analisada pela equipe BW9",
      "Acesso a materiais, aulas e turmas",
      "Notificações e comunicados centralizados",
    ],
    haveAccount: "Já tem cadastro?",
    login: "Faça login",
    successTitle: "Cadastro Realizado!",
    successText: "Seu cadastro foi enviado com sucesso. Aguarde a aprovação da equipe Blue World 9.",
    redirecting: "Você será redirecionado para o login em instantes...",
    errors: {
      required: "Todos os campos são obrigatórios",
      email: "E-mail inválido",
      passMin: "Senha deve ter no mínimo 6 caracteres",
      passMatch: "As senhas não coincidem",
      cpfInvalid: "CPF inválido",
      docInvalid: "Documento inválido",
    },
    placeholders: {
      name: "João Silva",
      email: "email@exemplo.com",
      phoneBR: "(11) 99999-9999",
      phoneLatam: "09 123 456",
      cpf: "000.000.000-00",
      ci: "0000000",
      passMin: "Mínimo 6 caracteres",
      passRepeat: "Digite a senha novamente",
    },
  },
  es: {
    title: "Registro de Profesor",
    subtitle: "Complete sus datos para solicitar acceso al portal",
    formTitle: "Solicitud de Registro",
    formSubtitle: "Completa tus datos para continuar",
    backHome: "Volver al sitio",
    name: "Nombre Completo",
    email: "Correo",
    phone: "Teléfono",
    country: "País",
    docCpf: "CPF",
    docCi: "Documento (CI)",
    password: "Contraseña",
    confirmPassword: "Confirmar Contraseña",
    submit: "Solicitar Registro",
    submitting: "Registrando...",
    highlights: [
      "Solicitud revisada por el equipo BW9",
      "Acceso a materiales, clases y grupos",
      "Notificaciones y avisos centralizados",
    ],
    haveAccount: "¿Ya tienes cuenta?",
    login: "Iniciar sesión",
    successTitle: "¡Registro enviado!",
    successText: "Tu registro fue enviado. Espera la aprobación del equipo Blue World 9.",
    redirecting: "Serás redirigido al login en instantes...",
    errors: {
      required: "Todos los campos son obligatorios",
      email: "Correo inválido",
      passMin: "La contraseña debe tener al menos 6 caracteres",
      passMatch: "Las contraseñas no coinciden",
      cpfInvalid: "CPF inválido",
      docInvalid: "Documento inválido",
    },
    placeholders: {
      name: "Juan Pérez",
      email: "email@ejemplo.com",
      phoneBR: "(11) 99999-9999",
      phoneLatam: "09 123 456",
      cpf: "000.000.000-00",
      ci: "0000000",
      passMin: "Mínimo 6 caracteres",
      passRepeat: "Repite la contraseña",
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

function formatPhone(value: string) {
  const numbers = onlyDigits(value)
  if (numbers.length <= 11) {
    return numbers.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2")
  }
  return value
}

// CPF real (BR)
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

// CI UY/PY: tamanhos variam; regra mínima por enquanto
function validateCI(doc: string): boolean {
  const numbers = onlyDigits(doc)
  return numbers.length >= 6 && numbers.length <= 12
}

export default function PortalCadastroPage() {
  const router = useRouter()

  const [country, setCountry] = useState<Country>("BR")
  const locale = useMemo(() => (country === "BR" ? "pt-BR" : "es"), [country])
  const t = i18n[locale]

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    documentNumber: "",
    password: "",
    confirmPassword: "",
  })
  const [consents, setConsents] = useState({
    acceptPrivacy: false,
    acceptTerms: false,
    acceptMarketing: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const homeUrl = (process.env.NEXT_PUBLIC_DOMAIN_PRINCIPAL || process.env.NEXT_PUBLIC_SITE_URL || "/").trim()

  const docLabel = country === "BR" ? t.docCpf : t.docCi
  const docPlaceholder = country === "BR" ? t.placeholders.cpf : t.placeholders.ci
  const consentText =
    locale === "pt-BR"
      ? {
          title: "Privacidade e LGPD",
          requiredError: "Para continuar, aceite os Termos de Uso e o Aviso de Privacidade.",
          acceptPrivacyPrefix: "Li e aceito o ",
          acceptPrivacyLink: "Aviso de Privacidade",
          acceptTermsPrefix: "Li e aceito os ",
          acceptTermsLink: "Termos de Uso",
          acceptMarketing: "Quero receber comunicacoes e novidades (opcional).",
        }
      : {
          title: "Privacidad y datos personales",
          requiredError: "Para continuar, acepta Terminos de Uso y Aviso de Privacidad.",
          acceptPrivacyPrefix: "Lei y acepto el ",
          acceptPrivacyLink: "Aviso de Privacidad",
          acceptTermsPrefix: "Lei y acepto los ",
          acceptTermsLink: "Terminos de Uso",
          acceptMarketing: "Quiero recibir comunicaciones y novedades (opcional).",
        }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.name || !formData.email || !formData.phone || !formData.documentNumber || !formData.password) {
      setError(t.errors.required)
      return
    }

    if (!emailRegex.test(formData.email)) {
      setError(t.errors.email)
      return
    }

    if (formData.password.length < 6) {
      setError(t.errors.passMin)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t.errors.passMatch)
      return
    }

    if (!consents.acceptPrivacy || !consents.acceptTerms) {
      setError(consentText.requiredError)
      return
    }

    if (country === "BR") {
      if (!validateCPF(formData.documentNumber)) {
        setError(t.errors.cpfInvalid)
        return
      }
    } else {
      if (!validateCI(formData.documentNumber)) {
        setError(t.errors.docInvalid)
        return
      }
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: onlyDigits(formData.phone),
          country,
          documentNumber: onlyDigits(formData.documentNumber),
          password: formData.password,
          acceptPrivacy: consents.acceptPrivacy,
          acceptTerms: consents.acceptTerms,
          acceptMarketing: consents.acceptMarketing,
        }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Erro ao cadastrar")

      setSuccess(true)
      setTimeout(() => router.push("/"), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
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

          <div className="grid flex-1 items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
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

            <Card className="relative w-full rounded-3xl border border-emerald-500/20 bg-slate-900/75 backdrop-blur-xl shadow-[0_24px_60px_-40px_rgba(16,185,129,0.6)]">
              <CardContent className="pt-10 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
                  <CheckCircle className="h-8 w-8 text-emerald-300" />
                </div>
                <h2 className="text-2xl font-semibold text-white">{t.successTitle}</h2>
                <p className="text-slate-300">{t.successText}</p>
                <p className="text-sm text-slate-400">{t.redirecting}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                        setFormData((p) => ({
                          ...p,
                          documentNumber: "",
                        }))
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

                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-200">
                    {t.name}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <Input
                      id="name"
                      type="text"
                      placeholder={t.placeholders.name}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    {t.email}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t.placeholders.email}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                    />
                  </div>
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-200">
                    {t.phone}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <Input
                      id="phone"
                      type="text"
                      placeholder={country === "BR" ? t.placeholders.phoneBR : t.placeholders.phoneLatam}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                    />
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
                      value={formData.documentNumber}
                      onChange={(e) => {
                        const v = e.target.value
                        setFormData({
                          ...formData,
                          documentNumber: country === "BR" ? formatCPF(v) : v,
                        })
                      }}
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
                      type={showPassword ? "text" : "password"}
                      placeholder={t.placeholders.passMin}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 pr-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-200">
                    {t.confirmPassword}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t.placeholders.passRepeat}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="h-11 border-white/10 bg-slate-900/60 pl-10 pr-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">{consentText.title}</p>

                  <label className="flex items-start gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={consents.acceptPrivacy}
                      onChange={(e) =>
                        setConsents((prev) => ({
                          ...prev,
                          acceptPrivacy: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                    <span>
                      {consentText.acceptPrivacyPrefix}
                      <Link href="/privacidade" target="_blank" className="text-cyan-300 hover:text-cyan-200 underline">
                        {consentText.acceptPrivacyLink}
                      </Link>
                      .
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={consents.acceptTerms}
                      onChange={(e) =>
                        setConsents((prev) => ({
                          ...prev,
                          acceptTerms: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                    <span>
                      {consentText.acceptTermsPrefix}
                      <Link href="/termos" target="_blank" className="text-cyan-300 hover:text-cyan-200 underline">
                        {consentText.acceptTermsLink}
                      </Link>
                      .
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={consents.acceptMarketing}
                      onChange={(e) =>
                        setConsents((prev) => ({
                          ...prev,
                          acceptMarketing: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                    <span>{consentText.acceptMarketing}</span>
                  </label>
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
                  {isLoading ? t.submitting : t.submit}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-slate-400">
                    {t.haveAccount}{" "}
                    <Link
                      href="/"
                      className="font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
                    >
                      {t.login}
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
