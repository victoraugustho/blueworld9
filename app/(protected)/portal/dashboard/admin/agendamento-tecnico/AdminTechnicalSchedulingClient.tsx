"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, ExternalLink } from "lucide-react"

type Locale = "pt-BR" | "es"

const APPOINTMENT_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ2zA2W-yhbINqWIYoGzJ-KH3WxsBoDV7kypaN2pU7ssnm7-ogD3XgYprRMm42AFHoN5Ge6BUtQb?gv=true"
const GOOGLE_STYLE_ID = "google-calendar-scheduling-style"
const GOOGLE_SCRIPT_ID = "google-calendar-scheduling-script"
const GOOGLE_LOAD_TIMEOUT_MS = 10000

declare global {
  interface Window {
    calendar?: {
      schedulingButton?: {
        load: (options: {
          url: string
          color?: string
          label?: string
          target: Element
        }) => void
      }
    }
  }
}

function ensureSchedulingStylesheet() {
  if (document.getElementById(GOOGLE_STYLE_ID)) return
  const link = document.createElement("link")
  link.id = GOOGLE_STYLE_ID
  link.rel = "stylesheet"
  link.href = "https://calendar.google.com/calendar/scheduling-button-script.css"
  document.head.appendChild(link)
}

function loadSchedulingScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.calendar?.schedulingButton) {
      resolve()
      return
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      let done = false
      const timeout = window.setTimeout(() => {
        if (done) return
        done = true
        reject(new Error("script-load-timeout"))
      }, GOOGLE_LOAD_TIMEOUT_MS)

      const handleReady = () => {
        if (done) return
        done = true
        window.clearTimeout(timeout)
        resolve()
      }

      const handleError = () => {
        if (done) return
        done = true
        window.clearTimeout(timeout)
        reject(new Error("script-load-failed"))
      }

      if (window.calendar?.schedulingButton) {
        handleReady()
        return
      }

      existing.addEventListener("load", handleReady, { once: true })
      existing.addEventListener("error", handleError, { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = GOOGLE_SCRIPT_ID
    script.async = true
    script.src = "https://calendar.google.com/calendar/scheduling-button-script.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("script-load-failed"))
    document.body.appendChild(script)
  })
}

export default function AdminTechnicalSchedulingClient({ locale }: { locale: Locale }) {
  const t =
    locale === "es"
      ? {
          title: "Agendamiento Tecnico",
          subtitle: "Agenda soporte tecnico usando la pagina de citas de Google Calendar.",
          cardTitle: "Programar soporte tecnico",
          cardDescription: "Haz clic en el boton para abrir el flujo de cita compartido.",
          buttonLabel: "Agendar una cita",
          loadingButton: "Cargando boton de Google Calendar...",
          loadError: "No fue posible cargar el boton automatico.",
          unavailableError: "El boton no esta disponible en este momento.",
          directLink: "Abrir enlace directo de agendamiento",
        }
      : {
          title: "Agendamento Tecnico",
          subtitle: "Agende suporte tecnico usando a pagina de compromissos do Google Calendar.",
          cardTitle: "Agendar suporte tecnico",
          cardDescription: "Use o botao abaixo para abrir o fluxo compartilhado de agendamento.",
          buttonLabel: "Agendar um compromisso",
          loadingButton: "Carregando botao do Google Calendar...",
          loadError: "Nao foi possivel carregar o botao automatico.",
          unavailableError: "O botao nao esta disponivel neste momento.",
          directLink: "Abrir link direto de agendamento",
        }

  const targetRef = useRef<HTMLDivElement | null>(null)
  const [loadError, setLoadError] = useState("")
  const [loadingButton, setLoadingButton] = useState(true)

  useEffect(() => {
    let cancelled = false
    const target = targetRef.current
    if (!target) return

    target.replaceChildren()
    setLoadError("")
    setLoadingButton(true)
    ensureSchedulingStylesheet()

    loadSchedulingScript()
      .then(() => {
        if (cancelled) return
        const schedulingButton = window.calendar?.schedulingButton
        if (!schedulingButton) {
          setLoadError(t.unavailableError)
          setLoadingButton(false)
          return
        }
        schedulingButton.load({
          url: APPOINTMENT_URL,
          color: "#0B8043",
          label: t.buttonLabel,
          target,
        })
        setLoadingButton(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t.loadError)
          setLoadingButton(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [locale, t.buttonLabel, t.loadError, t.unavailableError])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-cyan-300" />
          {t.title}
        </h1>
        <p className="text-slate-400 text-sm">{t.subtitle}</p>
      </div>

      <Card className="bg-slate-900/30 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">{t.cardTitle}</CardTitle>
          <CardDescription className="text-slate-400">{t.cardDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-start gap-3 w-full">
            <div ref={targetRef} className="min-h-[48px] w-full flex flex-col items-start gap-2 [&>*]:block" />

            <div className="w-full">
              <Button
                asChild
                className="mt-1 bg-cyan-600 hover:bg-cyan-700 text-white inline-flex items-center gap-2"
              >
                <a href={APPOINTMENT_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  {t.directLink}
                </a>
              </Button>
            </div>
          </div>

          {loadingButton && <p className="text-xs text-slate-400">{t.loadingButton}</p>}

          {loadError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm px-3 py-2">
              {loadError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

