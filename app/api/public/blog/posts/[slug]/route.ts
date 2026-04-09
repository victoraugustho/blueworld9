import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  BLOG_LANGUAGES,
  buildContentHtml,
  collectReferencedAssetIds,
  ensureBlogSchema,
  fetchAssetUrlMap,
  normalizeBlogContent,
  normalizeBlogLanguage,
} from "@/lib/blog"

type Ctx = { params: Promise<{ slug: string }> | { slug: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  await ensureBlogSchema()

  const resolved = await ctx.params
  const slug = String(resolved?.slug ?? "").trim()
  if (!slug) {
    return NextResponse.json({ error: "Slug invalido" }, { status: 400 })
  }

  const search = new URL(req.url).searchParams
  const languageRaw = String(search.get("language") ?? "pt-BR").trim()
  const format = String(search.get("format") ?? "html").trim().toLowerCase()

  if (!BLOG_LANGUAGES.includes(languageRaw as any)) {
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 })
  }

  if (format !== "html" && format !== "json") {
    return NextResponse.json({ error: "Formato invalido" }, { status: 400 })
  }

  const language = normalizeBlogLanguage(languageRaw)

  const [row] = await db`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.excerpt,
      p.post_type,
      p.instagram_url,
      p.content_json,
      p.content_html,
      p.language,
      p.published_at,
      p.seo_title,
      p.seo_description,
      p.canonical_url,
      p.noindex,
      seo.public_url AS seo_image_url,
      COALESCE(
        (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.name)
         FROM blog_post_categories pc
         JOIN blog_categories c ON c.id = pc.category_id
         WHERE pc.post_id = p.id),
        '[]'::jsonb
      ) AS categories,
      COALESCE(
        (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug) ORDER BY t.name)
         FROM blog_post_tags pt
         JOIN blog_tags t ON t.id = pt.tag_id
         WHERE pt.post_id = p.id),
        '[]'::jsonb
      ) AS tags
    FROM blog_posts p
    LEFT JOIN blog_assets seo ON seo.id = p.seo_image_asset_id
    WHERE p.slug = ${slug}
      AND p.language = ${language}
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      AND p.published_at IS NOT NULL
      AND p.published_at <= NOW()
    LIMIT 1
  `

  if (!row) {
    return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 })
  }

  const content = normalizeBlogContent(row.content_json)
  const referencedAssets = collectReferencedAssetIds(content)
  const assetMap = await fetchAssetUrlMap(referencedAssets)
  const html = row.content_html || buildContentHtml(content, assetMap)

  return NextResponse.json({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    post_type: row.post_type === "instagram" ? "instagram" : "article",
    instagram_url: row.instagram_url ?? null,
    content_html: format === "html" ? html : null,
    content_json: format === "json" ? content : null,
    language: row.language,
    published_at: row.published_at,
    seo: {
      title: row.seo_title,
      description: row.seo_description,
      image_url: row.seo_image_url,
      canonical_url: row.canonical_url,
      noindex: Boolean(row.noindex),
    },
    categories: Array.isArray(row.categories) ? row.categories : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
  })
}

