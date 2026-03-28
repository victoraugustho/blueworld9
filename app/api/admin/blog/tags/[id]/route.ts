import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import { ensureBlogSchema, slugify } from "@/lib/blog"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

function parseId(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const id = parseId(String(resolved?.id ?? ""))
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [row] = await db`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.created_at,
      COUNT(DISTINCT pt.post_id)::int AS post_count
    FROM blog_tags t
    LEFT JOIN blog_post_tags pt ON pt.tag_id = t.id
    LEFT JOIN blog_posts p ON p.id = pt.post_id AND p.deleted_at IS NULL
    WHERE t.id = ${id}
    GROUP BY t.id, t.name, t.slug, t.created_at
    LIMIT 1
  `

  if (!row) {
    return NextResponse.json({ error: "Tag nao encontrada" }, { status: 404 })
  }

  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const id = parseId(String(resolved?.id ?? ""))
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const hasName = body.name !== undefined
  const hasSlug = body.slug !== undefined

  const name = hasName ? String(body.name ?? "").trim() : null
  const rawSlug = hasSlug ? String(body.slug ?? "").trim() : null
  const slug = hasSlug ? slugify(rawSlug) : null

  if (!hasName && !hasSlug) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
  }

  if (hasName && !name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 })
  }

  if (hasSlug && !slug) {
    return NextResponse.json({ error: "Slug invalido" }, { status: 400 })
  }

  const [current] = await db`
    SELECT id, name, slug
    FROM blog_tags
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Tag nao encontrada" }, { status: 404 })
  }

  const nextName = hasName ? name : current.name
  const nextSlug = hasSlug ? slug : current.slug

  const [conflict] = await db`
    SELECT id
    FROM blog_tags
    WHERE id <> ${id}
      AND (
        LOWER(name) = LOWER(${nextName})
        OR slug = ${nextSlug}
      )
    LIMIT 1
  `

  if (conflict) {
    return NextResponse.json({ error: "Conflito de nome/slug" }, { status: 409 })
  }

  const [updated] = await db`
    UPDATE blog_tags
    SET
      name = ${nextName},
      slug = ${nextSlug}
    WHERE id = ${id}
    RETURNING id, name, slug, created_at
  `

  await writeAuditLog({
    req,
    action: "admin.blog.tags.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_tag", id },
    metadata: {
      name: updated?.name,
      slug: updated?.slug,
      updated_name: hasName,
      updated_slug: hasSlug,
    },
  })

  return NextResponse.json({ success: true, tag: updated })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const resolved = await ctx.params
  const id = parseId(String(resolved?.id ?? ""))
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [current] = await db`
    SELECT id, name, slug
    FROM blog_tags
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Tag nao encontrada" }, { status: 404 })
  }

  const [usage] = await db`
    SELECT COUNT(*)::int AS post_count
    FROM blog_post_tags
    WHERE tag_id = ${id}
  `

  await db`
    DELETE FROM blog_post_tags
    WHERE tag_id = ${id}
  `

  await db`
    DELETE FROM blog_tags
    WHERE id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.blog.tags.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_tag", id },
    metadata: {
      name: current.name,
      slug: current.slug,
      detached_posts: Number(usage?.post_count ?? 0),
    },
  })

  return NextResponse.json({ success: true })
}

