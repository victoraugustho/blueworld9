import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import {
  createBlogRevision,
  ensureBlogSchema,
  normalizeBlogLanguage,
  normalizeBlogPostType,
  normalizeInstagramUrl,
  normalizeBlogStatus,
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

type Ctx = { params: Promise<{ id: string }> }

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback
  return value === true
}

function buildInstagramContent(instagramUrl: string, excerpt: string | null) {
  const blocks: any[] = [{ type: "embed", provider: "generic", url: instagramUrl }]
  if (excerpt) {
    blocks.unshift({ type: "paragraph", children: [{ text: excerpt }] })
  }
  return { version: 1, blocks }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const post = await loadPostForAdmin(id)
  if (!post || post.deleted_at) {
    return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 })
  }

  return NextResponse.json(post)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const current = await loadPostForAdmin(id)
  if (!current || current.deleted_at) {
    return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  const title =
    body.title !== undefined ? String(body.title ?? "").trim() : String(current.title ?? "").trim()
  const slug =
    body.slug !== undefined
      ? slugify(body.slug || title)
      : String(current.slug ?? "").trim()
  const excerpt =
    body.excerpt !== undefined ? String(body.excerpt ?? "").trim() || null : current.excerpt

  const language =
    body.language !== undefined ? normalizeBlogLanguage(body.language) : normalizeBlogLanguage(current.language)
  const status =
    body.status !== undefined ? normalizeBlogStatus(body.status) : normalizeBlogStatus(current.status)
  const post_type =
    body.post_type !== undefined ? normalizeBlogPostType(body.post_type) : normalizeBlogPostType(current.post_type)

  const seo_title =
    body.seo_title !== undefined ? String(body.seo_title ?? "").trim() || null : current.seo_title
  const seo_description =
    body.seo_description !== undefined
      ? String(body.seo_description ?? "").trim() || null
      : current.seo_description
  const canonical_url =
    body.canonical_url !== undefined
      ? String(body.canonical_url ?? "").trim() || null
      : current.canonical_url
  const noindex = parseBoolean(body.noindex, Boolean(current.noindex))

  const author_id = admin.teacherId

  const cover_asset_id =
    body.cover_asset_id !== undefined
      ? normalizeUuidOrNull(body.cover_asset_id)
      : normalizeUuidOrNull(current.cover_asset_id)
  const seo_image_asset_id =
    body.seo_image_asset_id !== undefined
      ? normalizeUuidOrNull(body.seo_image_asset_id)
      : normalizeUuidOrNull(current.seo_image_asset_id)

  const instagram_url =
    post_type === "instagram"
      ? normalizeInstagramUrl(body.instagram_url !== undefined ? body.instagram_url : current.instagram_url)
      : null

  const nextIds =
    body.category_ids !== undefined || body.tag_ids !== undefined
      ? normalizePostIdArrays(body)
      : {
          category_ids: Array.isArray(current.category_ids) ? current.category_ids.map((item: any) => Number(item)) : [],
          tag_ids: Array.isArray(current.tag_ids) ? current.tag_ids.map((item: any) => Number(item)) : [],
        }
  const category_ids = nextIds.category_ids
  const tag_ids = nextIds.tag_ids

  const scheduledRaw =
    body.scheduled_at !== undefined ? body.scheduled_at : current.scheduled_at
  const publishedRaw =
    body.published_at !== undefined ? body.published_at : current.published_at

  const scheduledParsed = parseNullableDate(scheduledRaw)
  const publishedParsed = parseNullableDate(publishedRaw)

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
      AND id <> ${id}
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
      : body.content_json !== undefined
        ? body.content_json
        : current.content_json

  const prepared = await prepareBlogContent(contentInput, cover_asset_id, seo_image_asset_id)
  const content_json_payload = JSON.stringify(prepared.content_json)

  if (!(await ensureAssetIdsExist(prepared.referencedAssetIds))) {
    return NextResponse.json({ error: "Existe asset invalido no conteudo" }, { status: 400 })
  }

  const [updated] = await db`
    UPDATE blog_posts
    SET
      title = ${title},
      slug = ${slug},
      excerpt = ${excerpt},
      post_type = ${post_type},
      instagram_url = ${instagram_url},
      content_json = ${content_json_payload}::jsonb,
      content_html = ${prepared.content_html},
      content_text = ${prepared.content_text},
      language = ${language},
      status = ${status},
      published_at = ${published_at},
      scheduled_at = ${scheduled_at},
      first_published_at = CASE
        WHEN first_published_at IS NULL AND ${status} = 'published' THEN ${published_at}
        ELSE first_published_at
      END,
      author_id = ${author_id},
      updated_by = ${admin.teacherId},
      seo_title = ${seo_title},
      seo_description = ${seo_description},
      canonical_url = ${canonical_url},
      noindex = ${noindex},
      read_time_minutes = ${prepared.read_time_minutes},
      cover_asset_id = ${cover_asset_id},
      seo_image_asset_id = ${seo_image_asset_id}
    WHERE id = ${id}
    RETURNING id
  `

  if (!updated?.id) {
    return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 })
  }

  await replacePostRelations(id, category_ids, tag_ids)
  await syncPostAssetUsage(id, prepared.usageRows)
  await createBlogRevision(id, admin.teacherId)

  await writeAuditLog({
    req,
    action: "admin.blog.posts.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_post", id },
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

  const post = await loadPostForAdmin(id)
  return NextResponse.json({ success: true, post })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [current] = await db`
    SELECT id, title, slug, deleted_at
    FROM blog_posts
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current || current.deleted_at) {
    return NextResponse.json({ error: "Post nao encontrado" }, { status: 404 })
  }

  await db`
    UPDATE blog_posts
    SET
      status = 'archived',
      deleted_at = NOW(),
      updated_by = ${admin.teacherId}
    WHERE id = ${id}
  `

  await createBlogRevision(id, admin.teacherId)

  await writeAuditLog({
    req,
    action: "admin.blog.posts.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_post", id },
    metadata: { title: current.title, slug: current.slug },
  })

  return NextResponse.json({ success: true })
}

