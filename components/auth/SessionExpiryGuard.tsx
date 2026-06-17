"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

type Country = "BR" | "UY" | "PY"
type Locale = "pt-BR" | "es"
type ModalReason = "expired" | "unauthorized"

function onlyDigits(value: string) {
  return String(value ?? "").replace(/\D/g, "")
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

function getRequestPath(input: RequestInfo | URL) {
  if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      try {
        return new URL(input).pathname
      } catch {
        return input
      }
    }
    return input
  }

  if (input instanceof URL) {
    return input.pathname
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return new URL(input.url).pathname
    } catch {
      return input.url
    }
  }

  return ""
}

function isProtectedApiPath(pathname: string) {
  if (!pathname) return false

  const publicAuthPaths = [
    "/api/portal/login",
    "/api/portal/logout",
    "/api/portal/password-reset",
    "/api/portal/password-reset/request",
    "/api/portal/password-reset/confirm",
  ]

  if (publicAuthPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return false
  }

  return (
    pathname.startsWith("/api/portal/") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/ai/") ||
    pathname.startsWith("/api/files/") ||
    pathname.startsWith("/api/project-files/")
  )
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null
  const item = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
  if (!item) return null
  return decodeURIComponent(item.slice(name.length + 1))
}

function getInitialCountry(fallback: Country) {
  const value = getCookie("portal_country")
  if (value === "BR" || value === "UY" || value === "PY") return value
  return fallback
}

const copy = {
  "pt-BR": {
    title: "Sessão expirada",
    unauthorizedTitle: "Entre novamente",
    description:
      "Para proteger seus dados, confirme seu acesso aqui mesmo. A página não será recarregada e o que estiver preenchido continuará na tela.",
    country: "País",
    document: "Documento",
    cpf: "CPF",
    ci: "Documento (CI)",
    password: "Senha",
    passwordPlaceholder: "Digite sua senha",
    login: "Relogar e continuar",
    loading: "Validando...",
    goLogin: "Ir para a tela de login",
    required: "Documento e senha são obrigatórios.",
    genericError: "Não foi possível renovar a sessão.",
    success: "Sessão renovada. Pode continuar de onde parou.",
    show: "Mostrar",
    hide: "Ocultar",
  },
  es: {
    title: "Sesión expirada",
    unauthorizedTitle: "Ingresa nuevamente",
    description:
      "Para proteger tus datos, confirma el acceso aquí mismo. La página no se recargará y lo que esté completado seguirá en pantalla.",
    country: "País",
    document: "Documento",
    cpf: "CPF",
    ci: "Documento (CI)",
    password: "Contraseña",
    passwordPlaceholder: "Ingresa tu contraseña",
    login: "Ingresar y continuar",
    loading: "Validando...",
    goLogin: "Ir a la pantalla de acceso",
    required: "Documento y contraseña son obligatorios.",
    genericError: "No fue posible renovar la sesión.",
    success: "Sesión renovada. Puedes continuar donde estabas.",
    show: "Mostrar",
    hide: "Ocultar",
  },
} as const

export function SessionExpiryGuard({
  expiresAt,
  locale = "pt-BR",
  country: initialCountry = "BR",
}: {
  expiresAt: string
  locale?: Locale
  country?: Country
}) {
  const [sessionExpiresAt, setSessionExpiresAt] = useState(expiresAt)
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<ModalReason>("expired")
  const [country, setCountry] = useState<Country>(() => getInitialCountry(initialCountry))
  const [documentNumber, setDocumentNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const isOpenRef = useRef(false)

  const labels = copy[locale]
  const docLabel = country === "BR" ? labels.cpf : labels.ci
  const docPlaceholder = country === "BR" ? "000.000.000-00" : "0000000"

  const title = useMemo(() => {
    return reason === "expired" ? labels.title : labels.unauthorizedTitle
  }, [labels.title, labels.unauthorizedTitle, reason])

  function openSessionModal(nextReason: ModalReason) {
    if (isOpenRef.current) return
    setReason(nextReason)
    setError("")
    setSuccess("")
    setIsOpen(true)
  }

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    const expiresAtMs = new Date(sessionExpiresAt).getTime()
    if (!Number.isFinite(expiresAtMs)) return

    const delay = expiresAtMs - Date.now()
    if (delay <= 0) {
      openSessionModal("expired")
      return
    }

    const timeoutId = window.setTimeout(() => openSessionModal("expired"), delay + 250)
    return () => {
      window.clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpiresAt])

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    const patchedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (response.status === 401) {
        const pathname = getRequestPath(args[0])
        if (isProtectedApiPath(pathname)) {
          openSessionModal("unauthorized")
        }
      }

      return response
    }

    window.fetch = patchedFetch
    return () => {
      window.fetch = originalFetch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRelogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess("")

    const doc = onlyDigits(documentNumber)
    if (!doc || !password) {
      setError(labels.required)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          documentNumber: doc,
          password,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(String(data?.error ?? labels.genericError))
        return
      }

      const nextExpiresAt =
        typeof data?.sessionExpiresAt === "string"
          ? data.sessionExpiresAt
          : new Date(Date.now() + 60 * 60 * 1000).toISOString()

      setSessionExpiresAt(nextExpiresAt)
      setPassword("")
      setSuccess(labels.success)
      window.setTimeout(() => {
        setIsOpen(false)
        setSuccess("")
      }, 450)
    } catch {
      setError(labels.genericError)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-300/25 bg-slate-950/95 shadow-[0_28px_90px_-40px_rgba(34,211,238,0.75)]">
        <div className="relative border-b border-white/10 p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,47,73,0.64))]" />
          <div className="relative space-y-2">
            <span className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              BlueWorld9
            </span>
            <h2 id="session-expired-title" className="text-2xl font-bold text-white">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-slate-200">{labels.description}</p>
          </div>
        </div>

        <form onSubmit={handleRelogin} className="space-y-4 p-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="session-country">
              {labels.country}
            </label>
            <select
              id="session-country"
              value={country}
              onChange={(event) => {
                const nextCountry = event.target.value as Country
                setCountry(nextCountry)
                setDocumentNumber("")
                setError("")
              }}
              className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
            >
              <option value="BR">Brasil</option>
              <option value="UY">Uruguay</option>
              <option value="PY">Paraguay</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="session-document">
              {docLabel}
            </label>
            <input
              id="session-document"
              value={documentNumber}
              onChange={(event) => {
                const value = event.target.value
                setDocumentNumber(country === "BR" ? formatCPF(value) : value)
                setError("")
              }}
              placeholder={docPlaceholder}
              className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="session-password">
              {labels.password}
            </label>
            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-slate-900 focus-within:border-cyan-300">
              <input
                id="session-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError("")
                }}
                placeholder={labels.passwordPlaceholder}
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="px-3 text-xs font-semibold text-cyan-100 transition hover:bg-white/5"
              >
                {showPassword ? labels.hide : labels.show}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {success}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? labels.loading : labels.login}
            </button>
            <button
              type="button"
              onClick={() => window.location.replace("/")}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {labels.goLogin}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
