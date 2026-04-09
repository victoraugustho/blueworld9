import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import {
  BLOG_ASSET_USAGE_TYPES,
  createBlogRevision,
  ensureBlogSchema,
  isValidUuid,
  syncPostAssetUsage,
} from "@/lib/blog"
import {
  ensureAssetIdsExist,
  ensureCategoryIdsExist,
  ensureTagIdsExist,
  loadPostForAdmin,
  replacePostRelations,
} from "@/lib/blog-post-service"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

type SnapshotAsset = {
  asset_id: string
  usage_type: "cover" | "inline" | "gallery" | "seo"
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const postId = String(resolved?.id ?? "").trim()
  if (!postId) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const revisionId = String(body.revision_id ?? "").trim()

  if (!isValidUuid(revisionId)) {
    return NextResponse.json({ error: "revision_id invalido" }, { status: 400 })
  }

  const [revision] = await db`
    SELECT id, revision_number, snapshot
    FROM blog_post_revisions
    WHERE id = ${revisionId}
      AND post_id = ${postId}
    LIMIT 1
  `

  if (!revision) {
    return NextResponse.json({ error: "Revisao nao encontrada" }, { status: 404 })
  }

  const snapshot = revision.snapshot ?? {}
  const post = snapshot.post ?? null

  if (!post || String(post.id ?? "") !== postId) {
    return NextResponse.json({ error: "Snapshot invalido" }, { status: 422 })
  }

  const category_ids = Array.isArray(snapshot.category_ids)
    ? snapshot.category_ids.map((item: any) => Number(item)).filter((item: number) => Number.isInteger(item) && item > 0)
    : []

  const tag_ids = Array.isArray(snapshot.tag_ids)
    ? snapshot.tag_ids.map((item: any) => Number(item)).filter((item: number) => Number.isInteger(item) && item > 0)
    : []

  const assets: SnapshotAsset[] = Array.isArray(snapshot.assets)
    ? snapshot.assets
        .map((item: any) => ({
          asset_id: String(item?.asset_id ?? "").trim(),
          usage_type: String(item?.usage_type ?? "").trim() as SnapshotAsset["usage_type"],
        }))
        .filter(
          (item: SnapshotAsset) =>
            isValidUuid(item.asset_id) && BLOG_ASSET_USAGE_TYPES.includes(item.usage_type)
        )
    : []

  const assetIds: string[] = Array.from(new Set(assets.map((item) => item.asset_id)))

  if (!(await ensureCategoryIdsExist(category_ids))) {
    return NextResponse.json({ error: "Snapshot possui categoria invalida" }, { status: 422 })
  }

  if (!(await ensureTagIdsExist(tag_ids))) {
    return NextResponse.json({ error: "Snapshot possui tag invalida" }, { status: 422 })
  }

  if (!(await ensureAssetIdsExist(assetIds))) {
    return NextResponse.json({ error: "Snapshot possui asset invalido" }, { status: 422 })
  }

  const restoredContentJson = JSON.stringify(post.content_json ?? { version: 1, blocks: [] })

  await db`
    UPDATE blog_posts
    SET
      title = ${String(post.title ?? "")},
      slug = ${String(post.slug ?? "")},
      excerpt = ${post.excerpt ?? null},
      post_type = ${String(post.post_type ?? "article")},
      instagram_url = ${post.instagram_url ?? null},
      content_json = ${restoredContentJson}::jsonb,
      content_html = ${post.content_html ?? null},
      content_text = ${post.content_text ?? null},
      language = ${String(post.language ?? "pt-BR")},
      status = ${String(post.status ?? "draft")},
      published_at = ${post.published_at ?? null},
      scheduled_at = ${post.scheduled_at ?? null},
      first_published_at = ${post.first_published_at ?? null},
      author_id = ${post.author_id ?? null},
      seo_title = ${post.seo_title ?? null},
      seo_description = ${post.seo_description ?? null},
      canonical_url = ${post.canonical_url ?? null},
      noindex = ${Boolean(post.noindex)},
      read_time_minutes = ${post.read_time_minutes ?? null},
      cover_asset_id = ${post.cover_asset_id ?? null},
      seo_image_asset_id = ${post.seo_image_asset_id ?? null},
      deleted_at = ${post.deleted_at ?? null},
      updated_by = ${admin.teacherId}
    WHERE id = ${postId}
  `

  await replacePostRelations(postId, category_ids, tag_ids)
  await syncPostAssetUsage(postId, assets)
  await createBlogRevision(postId, admin.teacherId)

  await writeAuditLog({
    req,
    action: "admin.blog.posts.restore_revision",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_post", id: postId },
    metadata: { revision_id: revisionId, revision_number: revision.revision_number },
  })

  const restored = await loadPostForAdmin(postId)
  return NextResponse.json({ success: true, post: restored })
}



