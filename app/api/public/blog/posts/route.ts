import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { BLOG_LANGUAGES, ensureBlogSchema, normalizeBlogLanguage, parsePagination } from "@/lib/blog"

export async function GET(req: NextRequest) {
  await ensureBlogSchema()

  const search = new URL(req.url).searchParams
  const { page, page_size, offset } = parsePagination(search, { pageSize: 10, maxPageSize: 50 })

  const languageRaw = String(search.get("language") ?? "").trim()
  const language = languageRaw ? normalizeBlogLanguage(languageRaw) : null
  const categorySlug = String(search.get("category") ?? "").trim()
  const tagSlug = String(search.get("tag") ?? "").trim()
  const q = String(search.get("q") ?? "").trim()
  const sort = String(search.get("sort") ?? "newest").trim().toLowerCase()
  const order = sort === "oldest" ? "asc" : "desc"

  if (languageRaw && !BLOG_LANGUAGES.includes(languageRaw as any)) {
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 })
  }

  const filters: any[] = [
    db`p.deleted_at IS NULL`,
    db`p.status = 'published'`,
    db`p.published_at IS NOT NULL`,
    db`p.published_at <= NOW()`,
  ]

  if (language) {
    filters.push(db`p.language = ${language}`)
  }

  if (categorySlug) {
    filters.push(
      db`EXISTS (
          SELECT 1
          FROM blog_post_categories bpc
          JOIN blog_categories bc ON bc.id = bpc.category_id
          WHERE bpc.post_id = p.id
            AND bc.slug = ${categorySlug}
        )`
    )
  }

  if (tagSlug) {
    filters.push(
      db`EXISTS (
          SELECT 1
          FROM blog_post_tags bpt
          JOIN blog_tags bt ON bt.id = bpt.tag_id
          WHERE bpt.post_id = p.id
            AND bt.slug = ${tagSlug}
        )`
    )
  }

  if (q) {
    const like = `%${q}%`
    filters.push(db`(p.title ILIKE ${like} OR p.excerpt ILIKE ${like} OR p.content_text ILIKE ${like})`)
  }

  const where =
    filters.length > 0
      ? db`WHERE ${filters.reduce((acc, cur, idx) => (idx === 0 ? cur : db`${acc} AND ${cur}`))}`
      : db``

  const [countRow] = await db`
    SELECT COUNT(*)::int AS total
    FROM blog_posts p
    ${where}
  `

  const orderSql = order === "asc" ? db`ASC` : db`DESC`

  const items = await db`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.excerpt,
      p.language,
      p.published_at,
      p.read_time_minutes,
      cover.public_url AS cover_url,
      cover.width AS cover_width,
      cover.height AS cover_height,
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
    LEFT JOIN blog_assets cover ON cover.id = p.cover_asset_id
    ${where}
    ORDER BY p.published_at ${orderSql}, p.created_at ${orderSql}
    LIMIT ${page_size} OFFSET ${offset}
  `

  const normalized = (items as any[]).map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    language: item.language,
    published_at: item.published_at,
    read_time_minutes: item.read_time_minutes,
    cover: item.cover_url
      ? {
          url: item.cover_url,
          width: item.cover_width,
          height: item.cover_height,
        }
      : null,
    categories: Array.isArray(item.categories) ? item.categories : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
  }))

  return NextResponse.json({
    items: normalized,
    page,
    page_size,
    total: Number(countRow?.total ?? 0),
  })
}
