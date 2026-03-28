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
      c.id,
      c.name,
      c.slug,
      c.description,
      c.created_at,
      COUNT(DISTINCT pc.post_id)::int AS post_count
    FROM blog_categories c
    LEFT JOIN blog_post_categories pc ON pc.category_id = c.id
    LEFT JOIN blog_posts p ON p.id = pc.post_id AND p.deleted_at IS NULL
    GROUP BY c.id, c.name, c.slug, c.description, c.created_at
    ORDER BY c.name ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  const description = String(body.description ?? "").trim() || null
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
    FROM blog_categories
    WHERE LOWER(name) = LOWER(${name})
       OR slug = ${slug}
    LIMIT 1
  `

  if (exists) {
    return NextResponse.json({ error: "Categoria ja existe" }, { status: 409 })
  }

  const [created] = await db`
    INSERT INTO blog_categories (name, slug, description)
    VALUES (${name}, ${slug}, ${description})
    RETURNING id, name, slug, description, created_at
  `

  await writeAuditLog({
    req,
    action: "admin.blog.categories.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_category", id: created?.id },
    metadata: { name, slug },
  })

  return NextResponse.json({ success: true, category: created })
}

