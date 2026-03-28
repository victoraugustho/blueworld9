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
      t.id,
      t.name,
      t.slug,
      COUNT(DISTINCT p.id)::int AS post_count
    FROM blog_tags t
    LEFT JOIN blog_post_tags pt ON pt.tag_id = t.id
    LEFT JOIN blog_posts p ON p.id = pt.post_id
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      AND p.published_at IS NOT NULL
      AND p.published_at <= NOW()
      AND (${language}::text IS NULL OR p.language = ${language})
    GROUP BY t.id, t.name, t.slug
    HAVING COUNT(DISTINCT p.id) > 0
    ORDER BY t.name ASC
  `

  return NextResponse.json(rows)
}
