import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema, normalizeTeacherIds } from "@/lib/turmas"

type Ctx = { params: Promise<{ id: string }> | { id: string } }

function parseCategoryId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await ctx.params
  const id = parseCategoryId(String(resolved?.id ?? ""))
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [category] = await db`
    SELECT
      c.id,
      c.name,
      c.created_at,
      COUNT(DISTINCT m.id)::int AS material_count,
      COUNT(DISTINCT tc.teacher_id)::int AS teacher_count,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT tc.teacher_id), NULL),
        ARRAY[]::uuid[]
      ) AS teacher_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL),
        ARRAY[]::text[]
      ) AS teacher_names
    FROM categories c
    LEFT JOIN materials m ON m.category_id = c.id
    LEFT JOIN teacher_categories tc ON tc.category_id = c.id
    LEFT JOIN teachers t ON t.id = tc.teacher_id
    WHERE c.id = ${id}
    GROUP BY c.id, c.name, c.created_at
    LIMIT 1
  `

  if (!category) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
  }

  return NextResponse.json(category)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await ctx.params
  const id = parseCategoryId(String(resolved?.id ?? ""))
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const hasName = body.name !== undefined
  const name = hasName ? String(body.name ?? "").trim() : null
  const updateTeachers = Array.isArray(body.teacher_ids)
  const teacher_ids = normalizeTeacherIds(body.teacher_ids)

  if (!hasName && !updateTeachers) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
  }

  if (hasName && !name) {
    return NextResponse.json({ error: "Nome invalido" }, { status: 400 })
  }

  if (hasName) {
    const [duplicate] = await db`
      SELECT id
      FROM categories
      WHERE LOWER(name) = LOWER(${name})
        AND id <> ${id}
      LIMIT 1
    `

    if (duplicate) {
      return NextResponse.json({ error: "Ja existe uma categoria com esse nome" }, { status: 409 })
    }
  }

  if (updateTeachers && teacher_ids.length > 0) {
    const validTeachers = await db`
      SELECT id
      FROM teachers
      WHERE id = ANY(${teacher_ids}::uuid[])
    `

    if (validTeachers.length !== teacher_ids.length) {
      return NextResponse.json({ error: "Existe professor invalido na selecao" }, { status: 400 })
    }
  }

  const [existsCategory] = await db`
    SELECT id, name
    FROM categories
    WHERE id = ${id}
    LIMIT 1
  `

  if (!existsCategory) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
  }

  if (hasName) {
    await db`
      UPDATE categories
      SET name = ${name}
      WHERE id = ${id}
    `
  }

  if (updateTeachers) {
    await db`
      DELETE FROM teacher_categories
      WHERE category_id = ${id}
    `

    if (teacher_ids.length > 0) {
      await db`
        INSERT INTO teacher_categories (teacher_id, category_id)
        SELECT UNNEST(${teacher_ids}::uuid[]), ${id}
        ON CONFLICT (teacher_id, category_id) DO NOTHING
      `
    }
  }

  const [updated] = await db`
    SELECT
      c.id,
      c.name,
      c.created_at,
      COUNT(DISTINCT m.id)::int AS material_count,
      COUNT(DISTINCT tc.teacher_id)::int AS teacher_count,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT tc.teacher_id), NULL),
        ARRAY[]::uuid[]
      ) AS teacher_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL),
        ARRAY[]::text[]
      ) AS teacher_names
    FROM categories c
    LEFT JOIN materials m ON m.category_id = c.id
    LEFT JOIN teacher_categories tc ON tc.category_id = c.id
    LEFT JOIN teachers t ON t.id = tc.teacher_id
    WHERE c.id = ${id}
    GROUP BY c.id, c.name, c.created_at
    LIMIT 1
  `

  await writeAuditLog({
    req,
    action: "admin.categories.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "category", id },
    metadata: {
      name: hasName ? name : existsCategory.name,
      teacher_count: updated?.teacher_count ?? (updateTeachers ? teacher_ids.length : undefined),
      updated_name: hasName,
      updated_teachers: updateTeachers,
    },
  })

  return NextResponse.json({ success: true, category: updated })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await ctx.params
  const id = parseCategoryId(String(resolved?.id ?? ""))
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [current] = await db`
    SELECT id, name
    FROM categories
    WHERE id = ${id}
    LIMIT 1
  `

  if (!current) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
  }

  const [usage] = await db`
    SELECT
      (SELECT COUNT(*) FROM materials WHERE category_id = ${id})::int AS materials_count,
      (SELECT COUNT(*) FROM teacher_categories WHERE category_id = ${id})::int AS teachers_count
  `

  await db`
    UPDATE materials
    SET category_id = NULL
    WHERE category_id = ${id}
  `

  await db`
    DELETE FROM teacher_categories
    WHERE category_id = ${id}
  `

  const [deleted] = await db`
    DELETE FROM categories
    WHERE id = ${id}
    RETURNING id, name
  `

  if (!deleted) {
    return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.categories.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "category", id: deleted.id },
    metadata: {
      name: deleted.name,
      detached_materials: usage?.materials_count ?? 0,
      detached_teachers: usage?.teachers_count ?? 0,
    },
  })

  return NextResponse.json({ success: true, deleted })
}
