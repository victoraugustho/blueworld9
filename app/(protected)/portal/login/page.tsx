"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Lock, Eye, EyeOff, GraduationCap, Globe } from "lucide-react"
import Link from "next/link"
import { GlassmorphismNav } from "@/components/header"

type Country = "BR" | "UY" | "PY"

const i18n = {
  "pt-BR": {
    title: "Portal do Professor",
    subtitle: "Acesse sua área exclusiva com documento e senha",
    country: "País",
    docCpf: "CPF",
    docCi: "Documento (CI)",
    password: "Senha",
    button: "Entrar no Portal",
    loading: "Entrando...",
    noAccount: "Ainda não tem cadastro?",
    signup: "Cadastre-se aqui",
    errors: {
      required: "Documento e senha são obrigatórios",
      passMin: "Senha deve ter no mínimo 6 caracteres",
      cpfInvalid: "CPF inválido",
      docInvalid: "Documento inválido",
      notApproved: "Seu cadastro ainda não foi aprovado. Aguarde a análise.",
    },
  },
  es: {
    title: "Portal del Profesor",
    subtitle: "Accede con tu documento y contraseña",
    country: "País",
    docCpf: "CPF",
    docCi: "Documento (CI)",
    password: "Contraseña",
    button: "Entrar al Portal",
    loading: "Ingresando...",
    noAccount: "¿Aún no tienes registro?",
    signup: "Regístrate aquí",
    errors: {
      required: "Documento y contraseña son obligatorios",
      passMin: "La contraseña debe tener al menos 6 caracteres",
      cpfInvalid: "CPF inválido",
      docInvalid: "Documento inválido",
      notApproved: "Tu registro aún no fue aprobado. Espera la revisión.",
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

      // ✅ NUNCA setar cookie no client (o server já setou httpOnly)
      router.push("/portal/dashboard")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <GlassmorphismNav />

      <Card className="w-full max-w-md mt-30 relative z-10 bg-slate-900/80 backdrop-blur-xl border-cyan-500/20">
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
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    setDocumentNumber("")
                    setError("")
                  }}
                  className="w-full h-10 rounded-md pl-10 pr-3 bg-slate-800/50 border border-slate-700 text-white"
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
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                <Input
                  id="documentNumber"
                  type="text"
                  placeholder={docPlaceholder}
                  value={documentNumber}
                  onChange={(e) =>
                    setDocumentNumber(country === "BR" ? formatCPF(e.target.value) : e.target.value)
                  }
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
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
              {isLoading ? t.loading : t.button}
            </Button>

            <div className="text-center">
              <p className="text-slate-400 text-sm">
                {t.noAccount}{" "}
                <Link href="/portal/cadastro" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                  {t.signup}
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
