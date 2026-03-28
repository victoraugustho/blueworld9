import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import { ensureBlogSchema, slugify } from "@/lib/blog"

export async function GET() {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const rows = await db`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.created_at,
      COUNT(DISTINCT pt.post_id)::int AS post_count
    FROM blog_tags t
    LEFT JOIN blog_post_tags pt ON pt.tag_id = t.id
    LEFT JOIN blog_posts p ON p.id = pt.post_id AND p.deleted_at IS NULL
    GROUP BY t.id, t.name, t.slug, t.created_at
    ORDER BY t.name ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  const slugInput = String(body.slug ?? "").trim()
  const slug = slugify(slugInput || name)

  if (!name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 })
  }

  if (!slug) {
    return NextResponse.json({ error: "Slug invalido" }, { status: 400 })
  }

  const [exists] = await db`
    SELECT id
    FROM blog_tags
    WHERE LOWER(name) = LOWER(${name})
       OR slug = ${slug}
    LIMIT 1
  `

  if (exists) {
    return NextResponse.json({ error: "Tag ja existe" }, { status: 409 })
  }

  const [created] = await db`
    INSERT INTO blog_tags (name, slug)
    VALUES (${name}, ${slug})
    RETURNING id, name, slug, created_at
  `

  await writeAuditLog({
    req,
    action: "admin.blog.tags.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_tag", id: created?.id },
    metadata: { name, slug },
  })

  return NextResponse.json({ success: true, tag: created })
}

