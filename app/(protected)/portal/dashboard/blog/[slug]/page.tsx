import { getEffectivePortalLocale } from "@/lib/portal-locale"
﻿import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { requireTeacherPage } from "@/lib/auth/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Params = { params: Promise<{ slug: string }> }

type BlogPostDetails = {
  title: string
  slug: string
  excerpt: string | null
  post_type: "article" | "instagram"
  instagram_url: string | null
  content_html: string | null
  language: string
  published_at: string
  cover_url: string | null
  author_name: string | null
}

function formatDate(value: string, locale: "pt-BR" | "es") {
  try {
    return new Date(value).toLocaleString(locale === "es" ? "es-ES" : "pt-BR")
  } catch {
    return value
  }
}

function instagramEmbedUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (!(host === "instagram.com" || host === "www.instagram.com" || host.endsWith(".instagram.com"))) return null
    const parts = parsed.pathname.split("/").filter(Boolean)
    const kind = parts[0]?.toLowerCase() === "share" ? String(parts[1] ?? "").toLowerCase() : String(parts[0] ?? "").toLowerCase()
    const code = parts[0]?.toLowerCase() === "share" ? String(parts[2] ?? "").trim() : String(parts[1] ?? "").trim()
    if (!code) return null
    if (!["p", "reel", "tv"].includes(kind)) return null
    return `https://www.instagram.com/${kind}/${code}/embed`
  } catch {
    return null
  }
}

async function loadPostBySlug(slug: string, preferredLanguage: "pt-BR" | "es") {
  const [preferred] = await db`
    SELECT
      p.title,
      p.slug,
      p.excerpt,
      p.post_type,
      p.instagram_url,
      p.content_html,
      p.language,
      p.published_at,
      cover.public_url AS cover_url,
      author.name AS author_name
    FROM blog_posts p
    LEFT JOIN blog_assets cover ON cover.id = p.cover_asset_id
    LEFT JOIN teachers author ON author.id = p.author_id
    WHERE p.slug = ${slug}
      AND p.language = ${preferredLanguage}
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      AND p.published_at IS NOT NULL
      AND p.published_at <= NOW()
    LIMIT 1
  `
  if (preferred) return preferred as BlogPostDetails

  if (preferredLanguage === "pt-BR") return null

  const [fallback] = await db`
    SELECT
      p.title,
      p.slug,
      p.excerpt,
      p.post_type,
      p.instagram_url,
      p.content_html,
      p.language,
      p.published_at,
      cover.public_url AS cover_url,
      author.name AS author_name
    FROM blog_posts p
    LEFT JOIN blog_assets cover ON cover.id = p.cover_asset_id
    LEFT JOIN teachers author ON author.id = p.author_id
    WHERE p.slug = ${slug}
      AND p.language = 'pt-BR'
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      AND p.published_at IS NOT NULL
      AND p.published_at <= NOW()
    LIMIT 1
  `

  return (fallback ?? null) as BlogPostDetails | null
}

export default async function DashboardBlogPostPage({ params }: Params) {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)
  const resolved = await params
  const slug = String(resolved?.slug ?? "").trim()
  if (!slug) notFound()

  let post: BlogPostDetails | null = null
  try {
    post = await loadPostBySlug(slug, locale)
  } catch {
    post = null
  }

  if (!post) notFound()

  const instagramEmbed = post.post_type === "instagram" ? instagramEmbedUrl(post.instagram_url) : null

  return (
    <div className="p-4 md:p-6 text-white space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold line-clamp-2">{post.title}</h1>
          <p className="text-xs text-slate-300">
            Autor: <span className="text-white">{post.author_name || "Autor nao informado"}</span> | Publicado em:{" "}
            <span className="text-white">{formatDate(post.published_at, locale)}</span>
          </p>
        </div>
        <Link href="/portal/dashboard">
          <Button className="bg-white/10 hover:bg-white/15 border border-white/10">Voltar</Button>
        </Link>
      </div>

      <Card className="bg-slate-900/40 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {post.cover_url ? (
            <img
              src={post.cover_url}
              alt={post.title}
              className="w-full max-h-[420px] object-contain rounded-xl border border-white/10 bg-slate-900/40"
            />
          ) : null}

          {post.excerpt ? <p className="text-slate-200">{post.excerpt}</p> : null}

          {instagramEmbed ? (
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-[9/16] w-full max-w-[420px] mx-auto">
              <iframe
                src={instagramEmbed}
                title={`instagram-post-${post.slug}`}
                className="w-full h-full"
                loading="lazy"
                allowFullScreen
              />
            </div>
          ) : null}

          <article
            className="space-y-3 leading-relaxed text-slate-100 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:text-lg [&_h4]:font-semibold [&_p]:text-slate-100 [&_p]:mb-3 [&_img]:rounded-lg [&_img]:border [&_img]:border-white/10 [&_img]:my-4 [&_img]:w-full [&_img]:max-h-[460px] [&_img]:object-contain [&_img]:bg-slate-900/30 [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_hr]:border-white/15 [&_iframe]:my-4 [&_iframe]:w-full [&_iframe]:max-w-[760px] [&_iframe]:h-[420px] [&_iframe]:max-h-[55vh] [&_iframe]:mx-auto [&_iframe]:rounded-lg [&_iframe]:border [&_iframe]:border-white/10 [&_video]:my-4 [&_video]:w-full [&_video]:max-w-[760px] [&_video]:max-h-[55vh] [&_video]:mx-auto [&_video]:rounded-lg [&_video]:border [&_video]:border-white/10 [&_video]:bg-slate-900/30 [&_.blog-embed]:max-w-[760px] [&_.blog-embed]:mx-auto [&_.blog-embed-instagram]:aspect-[9/16] [&_.blog-embed-instagram]:w-full [&_.blog-embed-instagram]:max-w-[420px] [&_.blog-embed-instagram]:overflow-hidden [&_.blog-embed-instagram]:rounded-lg [&_.blog-embed-instagram]:border [&_.blog-embed-instagram]:border-white/10 [&_.blog-embed-instagram]:bg-black/40 [&_.blog-embed-instagram]:mx-auto [&_.blog-embed-instagram_iframe]:h-full [&_.blog-embed-instagram_iframe]:max-h-none"
            dangerouslySetInnerHTML={{ __html: post.content_html || "" }}
          />
        </CardContent>
      </Card>
    </div>
  )
}


