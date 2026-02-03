"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, RotateCcw, ArrowDown } from "lucide-react"

type ChatRole = "user" | "assistant" | "system"

type ChatMessage = {
  role: ChatRole
  content: string
  at?: number
}

type HistoryRow = {
  role: ChatRole
  content: string
  created_at: string
}

export function AIChatPanel({
  mode = "teacher",
  locale = "pt-BR",
}: {
  mode?: "teacher" | "admin"
  locale?: "pt-BR" | "es"
}) {
  const AI_NAME = "BW9 AI"

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const t = useMemo(() => {
    const isES = locale === "es"
    return {
      title: isES ? `Chat • ${AI_NAME}` : `Chat • ${AI_NAME}`,
      loading: isES ? "Cargando historial..." : "Carregando histórico...",
      empty: isES ? "Aún no hay mensajes. Escribe para empezar." : "Ainda não há mensagens. Escreva para começar.",
      placeholder: isES ? "Escribe tu mensaje..." : "Digite sua mensagem...",
      send: isES ? "Enviar" : "Enviar",
      retry: isES ? "Reintentar" : "Tentar novamente",
      goBottom: isES ? "Ir al final" : "Ir pro fim",
      historyError: isES ? "Error al cargar el historial." : "Erro ao carregar o histórico.",
      sendError: isES ? "Error al enviar el mensaje." : "Erro ao enviar a mensagem.",
      clear: isES ? "Limpiar chat" : "Limpar chat",
      clearing: isES ? "Limpiando..." : "Limpando...",
      clearConfirm: isES ? "¿Borrar toda la conversación?" : "Apagar toda a conversa?",
      clearError: isES ? "Error al limpiar el chat." : "Erro ao limpar o chat.",
      you: isES ? "Você" : "Você",
      ai: AI_NAME, // <- nome aplicado
      note: isES
        ? "Nota: La IA es conversacional. No ejecuta acciones dentro del sistema."
        : "Obs: A IA é apenas conversacional. Ela não executa ações dentro do sistema.",
    }
  }, [locale])

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" })
  }

  // detectar se usuário está longe do fim (pra mostrar botão "Ir pro fim")
  const [farFromBottom, setFarFromBottom] = useState(false)

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      setFarFromBottom(distance > 250)
    }

    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  async function loadHistory() {
    try {
      setError(null)
      setLoadingHistory(true)

      const res = await fetch("/api/ai/history", { cache: "no-store" })
      if (!res.ok) throw new Error("history_not_ok")

      const data = (await res.json()) as HistoryRow[]
      const parsed: ChatMessage[] = Array.isArray(data)
        ? data.map((m) => ({
            role: m.role,
            content: m.content,
            at: new Date(m.created_at).getTime(),
          }))
        : []

      setMessages(parsed)
      setLoadingHistory(false)

      setTimeout(() => scrollToBottom(false), 0)
    } catch {
      setLoadingHistory(false)
      setError(t.historyError)
    }
  }

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function clearHistory() {
    if (clearing) return
    const ok = confirm(t.clearConfirm)
    if (!ok) return

    try {
      setClearing(true)
      setError(null)

      const res = await fetch("/api/ai/history-delete", { method: "DELETE" })
      if (!res.ok) throw new Error("clear_not_ok")

      setMessages([])
      setInput("")
      setTimeout(() => scrollToBottom(false), 0)
    } catch {
      setError(t.clearError)
    } finally {
      setClearing(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setError(null)
    setInput("")

    const optimistic: ChatMessage = { role: "user", content: text, at: Date.now() }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 0)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ opcional: manda o nome pra reforçar (se você quiser usar no backend)
        body: JSON.stringify({ message: text, mode, locale, aiName: AI_NAME }),
      })

      if (!res.ok) throw new Error("chat_not_ok")

      const data = await res.json()
      const reply = String(data?.text ?? "").trim()

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply || "(sem resposta)", at: Date.now() },
      ])
      setTimeout(() => scrollToBottom(true), 0)
    } catch {
      setError(t.sendError)
    } finally {
      setSending(false)
    }
  }

  return (
  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col">
    {/* HEADER */}
    <div className="px-4 sm:px-5 py-4 border-b border-white/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-white font-semibold min-w-0 truncate">{t.title}</div>

        <div className="flex flex-wrap gap-2">
          {farFromBottom && (
            <Button
              variant="outline"
              className="bg-transparent border-white/20 text-white px-3"
              onClick={() => scrollToBottom(true)}
              title={t.goBottom}
            >
              <ArrowDown className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t.goBottom}</span>
            </Button>
          )}

          <Button
            variant="outline"
            className="bg-transparent border-white/20 text-white px-3"
            onClick={loadHistory}
            disabled={loadingHistory}
            title={t.retry}
          >
            <RotateCcw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{t.retry}</span>
          </Button>

          <Button
            variant="outline"
            className="bg-transparent border-red-500/30 text-red-300 hover:bg-red-500/10 px-3"
            onClick={clearHistory}
            disabled={clearing}
            title={t.clear}
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{clearing ? t.clearing : t.clear}</span>
          </Button>
        </div>
      </div>
    </div>

    {/* BODY (scroll) */}
    <div className="relative flex-1 min-h-0">
      <div
        ref={listRef}
        className="
          overflow-y-auto overscroll-contain
          px-4 sm:px-5 py-5 space-y-3
          h-[58dvh] sm:h-[60dvh] md:h-[65dvh]
        "
        // padding extra pro chat não ficar escondido atrás do footer sticky
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 120px)" }}
      >
        {loadingHistory && <p className="text-slate-400">{t.loading}</p>}

        {!loadingHistory && messages.length === 0 && (
          <p className="text-slate-400">{t.empty}</p>
        )}

        {!loadingHistory &&
          messages
            .filter((m) => m.role !== "system")
            .map((m, idx) => {
              const isUser = m.role === "user"
              return (
                <div
                  key={`${m.at ?? idx}-${idx}`}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[95%] sm:max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 border break-words ${
                      isUser
                        ? "bg-cyan-500/10 border-cyan-500/20 text-white"
                        : "bg-slate-800/40 border-white/10 text-slate-100"
                    }`}
                  >
                    <div className="text-xs mb-1 opacity-70">
                      {isUser ? t.you : t.ai}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 sm:px-5 pb-4">
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        </div>
      )}
    </div>

    {/* FOOTER sticky + safe-area */}
    <div
      className="
        sticky bottom-0 z-20
        border-t border-white/10
        bg-slate-950/60 backdrop-blur-xl
      "
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
    >
      <div className="p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={input}
            placeholder={t.placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send()
            }}
            className="bg-white/10 border-white/20 text-white h-11"
            disabled={sending}
          />

          <Button
            onClick={send}
            disabled={sending || !input.trim()}
            className="h-11 w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
          >
            {t.send}
          </Button>
        </div>

        <p className="text-xs text-slate-400 mt-2">{t.note}</p>
      </div>
    </div>
  </div>
)

}
