"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Phone, Lock, Eye, EyeOff, GraduationCap, CheckCircle, Globe } from "lucide-react"
import Link from "next/link"
import { GlassmorphismNav } from "@/components/header"

type Country = "BR" | "UY" | "PY"

const i18n = {
  "pt-BR": {
    title: "Cadastro de Professor",
    subtitle: "Preencha seus dados para solicitar acesso ao portal",
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
  },
  es: {
    title: "Registro de Profesor",
    subtitle: "Complete sus datos para solicitar acceso al portal",
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
  },
}

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
    documentNumber: "", // CPF/CI
    password: "",
    confirmPassword: "",
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const docLabel = country === "BR" ? t.docCpf : t.docCi
  const docPlaceholder = country === "BR" ? "000.000.000-00" : "0000000"

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

    // valida documento por país
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
        }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Erro ao cadastrar")

      setSuccess(true)
      setTimeout(() => router.push("/portal/login"), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="pt-30 relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <GlassmorphismNav />
        <Card className="w-full max-w-md relative z-10 bg-slate-900/80 backdrop-blur-xl border-green-500/20">
          <CardContent className="pt-12 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">{t.successTitle}</h2>
            <p className="text-slate-300">{t.successText}</p>
            <p className="text-sm text-slate-400">{t.redirecting}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="pt-30 relative min-h-screen flex items-center justify-center p-4">
      <GlassmorphismNav />

      <Card className="w-full max-w-md relative z-10 bg-slate-900/80 backdrop-blur-xl border-cyan-500/20 my-8">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            {t.title}
          </CardTitle>
          <CardDescription className="text-slate-300">{t.subtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* País */}
            <div className="space-y-2">
              <Label className="text-slate-200">{t.country}</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                <select
                  value={country}
                  onChange={(e) => {
                    const c = e.target.value as Country
                    setCountry(c)
                    // limpa doc quando muda país
                    setFormData((p) => ({ ...p, documentNumber: "" }))
                  }}
                  className="w-full h-10 rounded-md pl-10 pr-3 bg-slate-800/50 border border-slate-700 text-white"
                >
                  <option value="BR">Brasil</option>
                  <option value="UY">Uruguay</option>
                  <option value="PY">Paraguay</option>
                </select>
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-200">{t.name}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder={country === "BR" ? "João Silva" : "Juan Pérez"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">{t.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-200">{t.phone}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                <Input
                  id="phone"
                  type="text"
                  placeholder={country === "BR" ? "(11) 99999-9999" : "09 123 456"}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Documento */}
            <div className="space-y-2">
              <Label htmlFor="documentNumber" className="text-slate-200">{docLabel}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
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
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">{t.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={locale === "pt-BR" ? "Mínimo 6 caracteres" : "Mínimo 6 caracteres"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirmar */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-200">{t.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={locale === "pt-BR" ? "Digite a senha novamente" : "Repite la contraseña"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-6 rounded-lg transition-all transform hover:scale-105"
            >
              {isLoading ? t.submitting : t.submit}
            </Button>

            <div className="text-center">
              <p className="text-slate-400 text-sm">
                {t.haveAccount}{" "}
                <Link href="/portal/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                  {t.login}
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
