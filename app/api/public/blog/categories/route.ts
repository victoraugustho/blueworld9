import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { BLOG_LANGUAGES, ensureBlogSchema, normalizeBlogLanguage } from "@/lib/blog"

export async function GET(req: NextRequest) {
  await ensureBlogSchema()

  const search = new URL(req.url).searchParams
  const languageRaw = String(search.get("language") ?? "").trim()

  if (languageRaw && !BLOG_LANGUAGES.includes(languageRaw as any)) {
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 })
  }

  const language = languageRaw ? normalizeBlogLanguage(languageRaw) : null

  const rows = await db`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      COUNT(DISTINCT p.id)::int AS post_count
    FROM blog_categories c
    LEFT JOIN blog_post_categories pc ON pc.category_id = c.id
    LEFT JOIN blog_posts p ON p.id = pc.post_id
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      AND p.published_at IS NOT NULL
      AND p.published_at <= NOW()
      AND (${language}::text IS NULL OR p.language = ${language})
    GROUP BY c.id, c.name, c.slug, c.description
    HAVING COUNT(DISTINCT p.id) > 0
    ORDER BY c.name ASC
  `

  return NextResponse.json(rows)
}
