import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { ensureBlogSchema, parsePagination } from "@/lib/blog"

export async function GET(req: NextRequest) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const search = new URL(req.url).searchParams
  const { page, page_size, offset } = parsePagination(search, { pageSize: 20, maxPageSize: 100 })
  const q = String(search.get("q") ?? "").trim()
  const mime_type = String(search.get("mime_type") ?? "").trim()

  const filters: any[] = []

  if (q) {
    const like = `%${q}%`
    filters.push(db`(a.public_url ILIKE ${like} OR a.storage_key ILIKE ${like} OR a.alt_default ILIKE ${like})`)
  }

  if (mime_type) {
    filters.push(db`a.mime_type = ${mime_type}`)
  }

  const where =
    filters.length > 0
      ? db`WHERE ${filters.reduce((acc, cur, idx) => (idx === 0 ? cur : db`${acc} AND ${cur}`))}`
      : db``

  const [countRow] = await db`
    SELECT COUNT(*)::int AS total
    FROM blog_assets a
    ${where}
  `

  const items = await db`
    SELECT
      a.*,
      COALESCE(
        (SELECT JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', v.id,
              'variant', v.variant,
              'mime_type', v.mime_type,
              'width', v.width,
              'height', v.height,
              'size_bytes', v.size_bytes,
              'public_url', v.public_url
            )
            ORDER BY v.variant
          )
         FROM blog_asset_variants v
         WHERE v.asset_id = a.id),
        '[]'::jsonb
      ) AS variants
    FROM blog_assets a
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ${page_size} OFFSET ${offset}
  `

  return NextResponse.json({
    items,
    page,
    page_size,
    total: Number(countRow?.total ?? 0),
  })
}

