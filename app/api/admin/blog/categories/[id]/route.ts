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
      c.id,
      c.name,
      c.slug,
      c.description,
      c.created_at,
      COUNT(DISTINCT pc.post_id)::int AS post_count
    FROM blog_categories c
    LEFT JOIN blog_post_categories pc ON pc.category_id = c.id
    LEFT JOIN blog_posts p ON p.id = pc.post_id AND p.deleted_at IS NULL
    WHERE c.id = ${id}
    GROUP BY c.id, c.name, c.slug, c.description, c.created_at
    LIMIT 1
  `

  if (!row) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
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
  const hasDescription = body.description !== undefined

  const name = hasName ? String(body.name ?? "").trim() : null
  const rawSlug = hasSlug ? String(body.slug ?? "").trim() : null
  const slug = hasSlug ? slugify(rawSlug) : null
  const description = hasDescription ? String(body.description ?? "").trim() || null : undefined

  if (!hasName && !hasSlug && !hasDescription) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
  }

  if (hasName && !name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 })
  }

  if (hasSlug && !slug) {
    return NextResponse.json({ error: "Slug invalido" }, { status: 400 })
  }

  const [current] = await db`
    SELECT id, name, slug, description
    FROM blog_categories
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
  }

  if (hasName || hasSlug) {
    const nextName = hasName ? name : current.name
    const nextSlug = hasSlug ? slug : current.slug

    const [conflict] = await db`
      SELECT id
      FROM blog_categories
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
  }

  const [updated] = await db`
    UPDATE blog_categories
    SET
      name = ${hasName ? name : current.name},
      slug = ${hasSlug ? slug : current.slug},
      description = ${hasDescription ? description : current.description}
    WHERE id = ${id}
    RETURNING id, name, slug, description, created_at
  `

  await writeAuditLog({
    req,
    action: "admin.blog.categories.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_category", id },
    metadata: {
      name: updated?.name,
      slug: updated?.slug,
      updated_name: hasName,
      updated_slug: hasSlug,
      updated_description: hasDescription,
    },
  })

  return NextResponse.json({ success: true, category: updated })
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
    FROM blog_categories
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
  }

  const [usage] = await db`
    SELECT COUNT(*)::int AS post_count
    FROM blog_post_categories
    WHERE category_id = ${id}
  `

  await db`
    DELETE FROM blog_post_categories
    WHERE category_id = ${id}
  `

  await db`
    DELETE FROM blog_categories
    WHERE id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.blog.categories.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_category", id },
    metadata: {
      name: current.name,
      slug: current.slug,
      detached_posts: Number(usage?.post_count ?? 0),
    },
  })

  return NextResponse.json({ success: true })
}

