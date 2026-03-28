import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { ensureBlogSchema, parsePagination } from "@/lib/blog"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const postId = String(resolved?.id ?? "").trim()
  if (!postId) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const search = new URL(req.url).searchParams
  const { page, page_size, offset } = parsePagination(search, { pageSize: 20, maxPageSize: 100 })

  const [countRow] = await db`
    SELECT COUNT(*)::int AS total
    FROM blog_post_revisions
    WHERE post_id = ${postId}
  `

  const items = await db`
    SELECT
      r.id,
      r.post_id,
      r.revision_number,
      r.created_by,
      r.created_at,
      t.name AS created_by_name,
      t.email AS created_by_email
    FROM blog_post_revisions r
    LEFT JOIN teachers t ON t.id = r.created_by
    WHERE r.post_id = ${postId}
    ORDER BY r.revision_number DESC
    LIMIT ${page_size} OFFSET ${offset}
  `

  return NextResponse.json({
    items,
    page,
    page_size,
    total: Number(countRow?.total ?? 0),
  })
}

