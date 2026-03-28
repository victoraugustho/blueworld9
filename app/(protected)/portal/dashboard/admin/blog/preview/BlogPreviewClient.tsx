"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

type PreviewData = {
  title: string
  slug?: string
  excerpt?: string
  language?: "pt-BR" | "es"
  status?: "draft" | "review" | "scheduled" | "published" | "archived"
  scheduled_at?: string | null
  cover_asset_id?: string | null
  cover_image_url?: string | null
  author?: {
    id?: string
    name?: string
    email?: string
    avatar_url?: string | null
  } | null
  content_json?: {
    version?: number
    blocks?: any[]
  }
  asset_map?: Record<string, string>
  generated_at?: string
}

function safeString(value: unknown) {
  return String(value ?? "").trim()
}

function paragraphText(block: any) {
  const children = Array.isArray(block?.children) ? block.children : []
  const childText = children
    .map((item: any) => safeString(item?.text))
    .filter(Boolean)
    .join(" ")
  return childText || safeString(block?.text)
}

function youtubeEmbedUrl(raw: string) {
  const url = safeString(raw)
  if (!url) return null

  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v")
      if (id) return `https://www.youtube.com/embed/${id}`

      const parts = parsed.pathname.split("/").filter(Boolean)
      const maybeId = parts[parts.length - 1]
      if (maybeId) return `https://www.youtube.com/embed/${maybeId}`
    }

    if (parsed.hostname.includes("youtu.be")) {
      const parts = parsed.pathname.split("/").filter(Boolean)
      const id = parts[0]
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch {
    return null
  }

  return null
}

function formatDateTime(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString("pt-BR")
}

function initials(name: string) {
  const cleaned = safeString(name)
  if (!cleaned) return "A"
  const parts = cleaned.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((item) => item.charAt(0).toUpperCase()).join("")
}

function isDirectVideoUrl(raw: string) {
  const url = safeString(raw).toLowerCase()
  if (!url) return false
  return (
    url.endsWith(".mp4") ||
    url.endsWith(".webm") ||
    url.endsWith(".ogg") ||
    url.endsWith(".mov") ||
    url.includes(".mp4?") ||
    url.includes(".webm?") ||
    url.includes(".ogg?") ||
    url.includes(".mov?")
  )
}

export default function BlogPreviewClient() {
  const searchParams = useSearchParams()
  const draftId = String(searchParams.get("draft") ?? "").trim()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PreviewData | null>(null)

  useEffect(() => {
    if (!draftId) {
      setLoading(false)
      setData(null)
      return
    }

    const raw = localStorage.getItem(`blog_preview_${draftId}`)
    if (!raw) {
      setLoading(false)
      setData(null)
      return
    }

    try {
      const parsed = JSON.parse(raw)
      setData(parsed)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [draftId])

  const blocks = useMemo(() => {
    if (!Array.isArray(data?.content_json?.blocks)) return []
    return data?.content_json?.blocks ?? []
  }, [data])

  if (loading) {
    return <div className="p-6 text-white">Carregando preview...</div>
  }

  if (!data) {
    return (
      <div className="p-6 text-white space-y-4">
        <p className="text-slate-300">Nao foi possivel carregar o rascunho de preview.</p>
        <Link href="/portal/dashboard/admin/blog/new">
          <Button className="bg-cyan-600 hover:bg-cyan-700">Voltar ao Editor</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Preview</p>
            <h1 className="text-2xl md:text-3xl font-bold">{safeString(data.title) || "Sem titulo"}</h1>
            {safeString(data.excerpt) && <p className="text-slate-300 mt-2">{safeString(data.excerpt)}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/portal/dashboard/admin/blog/new">
              <Button className="bg-white/10 hover:bg-white/15 border border-white/10">Voltar ao Editor</Button>
            </Link>
            <Link href="/portal/dashboard/admin/blog">
              <Button className="bg-cyan-600 hover:bg-cyan-700">Painel do Blog</Button>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 flex flex-wrap gap-x-5 gap-y-1">
          <span>Status: {safeString(data.status) || "draft"}</span>
          <span>Idioma: {safeString(data.language) || "pt-BR"}</span>
          {formatDateTime(data.scheduled_at) && <span>Agendado: {formatDateTime(data.scheduled_at)}</span>}
          {formatDateTime(data.generated_at) && <span>Gerado em: {formatDateTime(data.generated_at)}</span>}
        </div>

        {(safeString(data.author?.name) || safeString(data.author?.email)) && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
            {safeString(data.author?.avatar_url) ? (
              <img
                src={safeString(data.author?.avatar_url)}
                alt={safeString(data.author?.name) || "Autor"}
                className="h-10 w-10 rounded-full object-cover border border-white/20"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-cyan-700/60 border border-cyan-400/40 flex items-center justify-center text-sm font-semibold">
                {initials(safeString(data.author?.name) || "Autor")}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{safeString(data.author?.name) || "Autor"}</p>
              <p className="text-xs text-slate-300 truncate">{safeString(data.author?.email)}</p>
            </div>
          </div>
        )}

        {data.cover_image_url && (
          <img
            src={data.cover_image_url}
            alt={safeString(data.title) || "Capa"}
            className="w-full max-h-[420px] object-cover rounded-2xl border border-white/10"
          />
        )}

        <article className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 md:p-7 space-y-5 leading-relaxed">
          {blocks.length === 0 && <p className="text-slate-400">Sem blocos para exibir.</p>}

          {blocks.map((block, index) => {
            const type = safeString(block?.type)

            if (type === "heading") {
              const level = Math.min(4, Math.max(1, Number(block?.level) || 2))
              const text = safeString(block?.text)
              if (!text) return null

              if (level === 1) return <h1 key={index} className="text-3xl font-bold">{text}</h1>
              if (level === 2) return <h2 key={index} className="text-2xl font-bold">{text}</h2>
              if (level === 3) return <h3 key={index} className="text-xl font-semibold">{text}</h3>
              return <h4 key={index} className="text-lg font-semibold">{text}</h4>
            }

            if (type === "paragraph") {
              const text = paragraphText(block)
              if (!text) return null
              return <p key={index} className="text-slate-100">{text}</p>
            }

            if (type === "quote") {
              const text = safeString(block?.text)
              if (!text) return null
              return (
                <blockquote key={index} className="border-l-4 border-cyan-400/80 pl-4 italic text-slate-200">
                  {text}
                </blockquote>
              )
            }

            if (type === "list") {
              const itemsRaw = Array.isArray(block?.items) ? block.items : []
              const items = itemsRaw.map((item: any) => safeString(item)).filter(Boolean)
              if (items.length === 0) return null

              if (block?.ordered === true) {
                return (
                  <ol key={index} className="list-decimal pl-6 space-y-1 text-slate-100">
                    {items.map((item: string, itemIndex: number) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ol>
                )
              }

              return (
                <ul key={index} className="list-disc pl-6 space-y-1 text-slate-100">
                  {items.map((item: string, itemIndex: number) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )
            }

            if (type === "image") {
              const assetId = safeString(block?.asset_id)
              const src = safeString(block?.url) || safeString(data.asset_map?.[assetId])
              if (!src) return null

              return (
                <figure key={index} className="space-y-2">
                  <img
                    src={src}
                    alt={safeString(block?.alt) || "Imagem do bloco"}
                    className="w-full rounded-xl border border-white/10"
                  />
                  {safeString(block?.caption) && <figcaption className="text-xs text-slate-400">{safeString(block?.caption)}</figcaption>}
                </figure>
              )
            }

            if (type === "embed") {
              const url = safeString(block?.url)
              if (!url) return null
              const provider = safeString(block?.provider)

              if (provider === "youtube") {
                const embed = youtubeEmbedUrl(url)
                if (!embed) {
                  return (
                    <p key={index} className="text-amber-300 text-sm">
                      URL de YouTube invalida: {url}
                    </p>
                  )
                }
                return (
                  <div key={index} className="rounded-xl overflow-hidden border border-white/10 aspect-video">
                    <iframe
                      src={embed}
                      title={`video-${index}`}
                      className="w-full h-full"
                      loading="lazy"
                      allowFullScreen
                    />
                  </div>
                )
              }

              if (provider === "video" || isDirectVideoUrl(url)) {
                return (
                  <div key={index} className="rounded-xl overflow-hidden border border-white/10 bg-black">
                    <video src={url} controls className="w-full" preload="metadata" />
                  </div>
                )
              }

              return (
                <p key={index}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">
                    {url}
                  </a>
                </p>
              )
            }

            if (type === "divider") {
              return <hr key={index} className="border-white/15" />
            }

            return null
          })}
        </article>
      </div>
    </div>
  )
}

