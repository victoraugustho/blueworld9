import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import { createBlogRevision, ensureBlogSchema, normalizeBlogStatus } from "@/lib/blog"
import { loadPostForAdmin, parseNullableDate } from "@/lib/blog-post-service"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
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
  const status = normalizeBlogStatus(body.status)
  const scheduledParsed = parseNullableDate(body.scheduled_at !== undefined ? body.scheduled_at : current.scheduled_at)
  const publishedParsed = parseNullableDate(body.published_at !== undefined ? body.published_at : current.published_at)

  if (scheduledParsed === "invalid" || publishedParsed === "invalid") {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 })
  }

  let scheduled_at = scheduledParsed
  let published_at = publishedParsed

  if (status === "scheduled" && !scheduled_at) {
    return NextResponse.json({ error: "scheduled_at obrigatorio para status scheduled" }, { status: 400 })
  }

  if (status === "published" && !published_at) {
    published_at = new Date()
  }

  if (status !== "scheduled") scheduled_at = null
  if (status === "draft" || status === "review") published_at = null

  await db`
    UPDATE blog_posts
    SET
      status = ${status},
      scheduled_at = ${scheduled_at},
      published_at = ${published_at},
      first_published_at = CASE
        WHEN first_published_at IS NULL AND ${status} = 'published' THEN ${published_at}
        ELSE first_published_at
      END,
      updated_by = ${admin.teacherId}
    WHERE id = ${id}
  `

  await createBlogRevision(id, admin.teacherId)

  await writeAuditLog({
    req,
    action: "admin.blog.posts.status.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_post", id },
    metadata: { status, scheduled_at, published_at },
  })

  const post = await loadPostForAdmin(id)
  return NextResponse.json({ success: true, post })
}

