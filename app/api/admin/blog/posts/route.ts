import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import {
  BLOG_LANGUAGES,
  BLOG_POST_TYPES,
  BLOG_STATUSES,
  createBlogRevision,
  ensureBlogSchema,
  normalizeBlogLanguage,
  normalizeBlogPostType,
  normalizeInstagramUrl,
  normalizeBlogStatus,
  parsePagination,
  slugify,
  syncPostAssetUsage,
} from "@/lib/blog"
import {
  ensureAssetIdsExist,
  ensureCategoryIdsExist,
  ensureTagIdsExist,
  loadPostForAdmin,
  normalizePostIdArrays,
  normalizeUuidOrNull,
  parseNullableDate,
  prepareBlogContent,
  replacePostRelations,
} from "@/lib/blog-post-service"

function buildInstagramContent(instagramUrl: string, excerpt: string | null) {
  const blocks: any[] = [{ type: "embed", provider: "generic", url: instagramUrl }]
  if (excerpt) {
    blocks.unshift({ type: "paragraph", children: [{ text: excerpt }] })
  }
  return { version: 1, blocks }
}

export async function GET(req: NextRequest) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const search = new URL(req.url).searchParams
  const { page, page_size, offset } = parsePagination(search, { pageSize: 20, maxPageSize: 100 })

  const q = String(search.get("q") ?? "").trim()
  const status = String(search.get("status") ?? "").trim()
  const language = String(search.get("language") ?? "").trim()
  const postType = String(search.get("post_type") ?? "").trim()
  const categoryId = Number(search.get("category_id") ?? "")
  const tagId = Number(search.get("tag_id") ?? "")
  const authorId = String(search.get("author_id") ?? "").trim()

  if (status && status !== "all" && !BLOG_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 })
  }

  if (language && language !== "all" && !BLOG_LANGUAGES.includes(language as any)) {
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 })
  }

  if (postType && postType !== "all" && !BLOG_POST_TYPES.includes(postType as any)) {
    return NextResponse.json({ error: "Tipo de post invalido" }, { status: 400 })
  }

  const filters: any[] = [db`p.deleted_at IS NULL`]

  if (status && status !== "all") {
    filters.push(db`p.status = ${status}`)
  }

  if (language && language !== "all") {
    filters.push(db`p.language = ${language}`)
  }

  if (postType && postType !== "all") {
    filters.push(db`p.post_type = ${postType}`)
  }

  if (Number.isInteger(categoryId) && categoryId > 0) {
    filters.push(
      db`EXISTS (SELECT 1 FROM blog_post_categories bpc WHERE bpc.post_id = p.id AND bpc.category_id = ${categoryId})`
    )
  }

  if (Number.isInteger(tagId) && tagId > 0) {
    filters.push(db`EXISTS (SELECT 1 FROM blog_post_tags bpt WHERE bpt.post_id = p.id AND bpt.tag_id = ${tagId})`)
  }

  if (authorId) {
    const validAuthor = normalizeUuidOrNull(authorId)
    if (!validAuthor) {
      return NextResponse.json({ error: "author_id invalido" }, { status: 400 })
    }
    filters.push(db`p.author_id = ${validAuthor}`)
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

  const items = await db`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.excerpt,
      p.language,
      p.status,
      p.post_type,
      p.instagram_url,
      p.author_id,
      p.cover_asset_id,
      p.seo_image_asset_id,
      p.published_at,
      p.scheduled_at,
      p.first_published_at,
      p.noindex,
      p.read_time_minutes,
      p.created_at,
      p.updated_at,
      author.name AS author_name,
      author.email AS author_email,
      author.avatar_url AS author_avatar_url,
      cover.public_url AS cover_image_url,
      seo.public_url AS seo_image_url,
      COALESCE(
        (SELECT ARRAY_AGG(pc.category_id ORDER BY pc.category_id)
         FROM blog_post_categories pc
         WHERE pc.post_id = p.id),
        ARRAY[]::int[]
      ) AS category_ids,
      COALESCE(
        (SELECT ARRAY_AGG(pt.tag_id ORDER BY pt.tag_id)
         FROM blog_post_tags pt
         WHERE pt.post_id = p.id),
        ARRAY[]::int[]
      ) AS tag_ids
    FROM blog_posts p
    LEFT JOIN teachers author ON author.id = p.author_id
    LEFT JOIN blog_assets cover ON cover.id = p.cover_asset_id
    LEFT JOIN blog_assets seo ON seo.id = p.seo_image_asset_id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT ${page_size} OFFSET ${offset}
  `

  return NextResponse.json({
    items,
    page,
    page_size,
    total: Number(countRow?.total ?? 0),
  })
}

export async function POST(req: NextRequest) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? "").trim()
  const slug = slugify(body.slug || title)
  const excerpt = String(body.excerpt ?? "").trim() || null
  const language = normalizeBlogLanguage(body.language)
  const status = normalizeBlogStatus(body.status)
  const post_type = normalizeBlogPostType(body.post_type)
  const seo_title = String(body.seo_title ?? "").trim() || null
  const seo_description = String(body.seo_description ?? "").trim() || null
  const canonical_url = String(body.canonical_url ?? "").trim() || null
  const instagram_url = post_type === "instagram" ? normalizeInstagramUrl(body.instagram_url) : null
  const noindex = body.noindex === true
  const author_id = admin.teacherId
  const cover_asset_id = normalizeUuidOrNull(body.cover_asset_id)
  const seo_image_asset_id = normalizeUuidOrNull(body.seo_image_asset_id)
  const { category_ids, tag_ids } = normalizePostIdArrays(body)

  const scheduledParsed = parseNullableDate(body.scheduled_at)
  const publishedParsed = parseNullableDate(body.published_at)

  if (scheduledParsed === "invalid" || publishedParsed === "invalid") {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 })
  }

  let scheduled_at = scheduledParsed
  let published_at = publishedParsed

  if (!title) {
    return NextResponse.json({ error: "Titulo obrigatorio" }, { status: 400 })
  }

  if (!slug) {
    return NextResponse.json({ error: "Slug invalido" }, { status: 400 })
  }

  if (post_type === "instagram" && !instagram_url) {
    return NextResponse.json({ error: "Link do Instagram invalido" }, { status: 400 })
  }

  if (status === "scheduled" && !scheduled_at) {
    return NextResponse.json({ error: "scheduled_at obrigatorio para status scheduled" }, { status: 400 })
  }

  if (status === "published" && !published_at) {
    published_at = new Date()
  }

  if (status !== "scheduled") scheduled_at = null
  if (status === "draft" || status === "review") published_at = null

  const [duplicate] = await db`
    SELECT id
    FROM blog_posts
    WHERE slug = ${slug}
      AND language = ${language}
      AND deleted_at IS NULL
    LIMIT 1
  `

  if (duplicate) {
    return NextResponse.json({ error: "Slug ja existe para este idioma" }, { status: 409 })
  }

  if (!(await ensureCategoryIdsExist(category_ids))) {
    return NextResponse.json({ error: "Existe categoria invalida na selecao" }, { status: 400 })
  }

  if (!(await ensureTagIdsExist(tag_ids))) {
    return NextResponse.json({ error: "Existe tag invalida na selecao" }, { status: 400 })
  }

  const contentInput =
    post_type === "instagram"
      ? buildInstagramContent(instagram_url as string, excerpt)
      : body.content_json
  const prepared = await prepareBlogContent(contentInput, cover_asset_id, seo_image_asset_id)
  const content_json_payload = JSON.stringify(prepared.content_json)

  if (!(await ensureAssetIdsExist(prepared.referencedAssetIds))) {
    return NextResponse.json({ error: "Existe asset invalido no conteudo" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO blog_posts (
      title,
      slug,
      excerpt,
      post_type,
      instagram_url,
      content_json,
      content_html,
      content_text,
      language,
      status,
      published_at,
      scheduled_at,
      first_published_at,
      author_id,
      created_by,
      updated_by,
      seo_title,
      seo_description,
      canonical_url,
      noindex,
      read_time_minutes,
      cover_asset_id,
      seo_image_asset_id
    )
    VALUES (
      ${title},
      ${slug},
      ${excerpt},
      ${post_type},
      ${instagram_url},
      ${content_json_payload}::jsonb,
      ${prepared.content_html},
      ${prepared.content_text},
      ${language},
      ${status},
      ${published_at},
      ${scheduled_at},
      ${status === "published" ? published_at : null},
      ${author_id},
      ${admin.teacherId},
      ${admin.teacherId},
      ${seo_title},
      ${seo_description},
      ${canonical_url},
      ${noindex},
      ${prepared.read_time_minutes},
      ${cover_asset_id},
      ${seo_image_asset_id}
    )
    RETURNING id
  `

  if (!created?.id) {
    return NextResponse.json({ error: "Falha ao criar post" }, { status: 500 })
  }

  await replacePostRelations(created.id, category_ids, tag_ids)
  await syncPostAssetUsage(created.id, prepared.usageRows)
  await createBlogRevision(created.id, admin.teacherId)

  await writeAuditLog({
    req,
    action: "admin.blog.posts.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_post", id: created.id },
    metadata: {
      title,
      slug,
      status,
      post_type,
      instagram_url,
      language,
      category_count: category_ids.length,
      tag_count: tag_ids.length,
    },
  })

  const post = await loadPostForAdmin(created.id)
  return NextResponse.json({ success: true, post })
}

