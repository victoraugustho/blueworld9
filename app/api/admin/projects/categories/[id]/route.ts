import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import {
  ensureProjectsSchema,
  isUuid,
  isProjectCategoryAccessReady,
  normalizeProjectCategoryStatus,
  normalizeProjectLocale,
} from "@/lib/projects"
import {
  normalizeProjectCategoryAccessBody,
  validateProjectCategoryAccessPolicy,
  validateProjectCategoryTeachers,
} from "@/lib/project-category-access-server"

type Ctx = { params: Promise<{ id: string }> }

function normalizeCategoryPayload(body: any) {
  return {
    locale: normalizeProjectLocale(body?.locale),
    status: normalizeProjectCategoryStatus(body?.status),
    title: String(body?.title ?? "").trim(),
    description: String(body?.description ?? "").trim() || null,
    cover_image_url: String(body?.cover_image_url ?? "").trim() || null,
    sort_order: Number.isInteger(Number(body?.sort_order)) ? Number(body.sort_order) : 0,
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const payload = normalizeCategoryPayload(body)
  const accessPolicy = normalizeProjectCategoryAccessBody(body)

  if (!payload.title) {
    return NextResponse.json({ error: "Título da categoria é obrigatório." }, { status: 400 })
  }

  const policyError = validateProjectCategoryAccessPolicy(accessPolicy)
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 })
  if (!categoryAccessReady) {
    return NextResponse.json(
      { error: "A migração 044_project_category_access.sql precisa ser aplicada antes de salvar acessos por categoria." },
      { status: 503 },
    )
  }
  const teacherError = await validateProjectCategoryTeachers(accessPolicy)
  if (teacherError) return NextResponse.json({ error: teacherError }, { status: 400 })

  const [updated] = await db`
    UPDATE public.teacher_project_categories
    SET
      locale = ${payload.locale},
      status = ${payload.status},
      title = ${payload.title},
      description = ${payload.description},
      cover_image_url = ${payload.cover_image_url},
      sort_order = ${payload.sort_order},
      access_scope = ${accessPolicy.access_scope},
      target_teacher_ids = ${accessPolicy.target_teacher_ids}::uuid[],
      target_countries = ${accessPolicy.target_countries}::text[],
      target_locales = ${accessPolicy.target_locales}::text[],
      updated_by = ${auth.teacherId},
      updated_at = NOW()
    WHERE id = ${id}
      AND deleted_at IS NULL
    RETURNING id
  `

  if (!updated) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 })

  await writeAuditLog({
    req,
    action: "admin.projects.categories.update",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project_category", id },
    metadata: { ...payload, ...accessPolicy },
  })

  return NextResponse.json({ id, ...payload, ...accessPolicy })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const [category] = await db`
    SELECT id, locale, title
    FROM public.teacher_project_categories
    WHERE id = ${id}
      AND deleted_at IS NULL
    LIMIT 1
  `

  if (!category) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 })

  const categoryLocale = category.locale === "es" ? "es" : "pt-BR"
  const defaultTitle = categoryLocale === "es" ? "General" : "Geral"
  const defaultDescription =
    categoryLocale === "es"
      ? "Proyectos generales con Arduino, Micro:Bit, MakeyMakey, MBlock, programación y circuitos."
      : "Projetos gerais com Arduino, Micro:Bit, MakeyMakey, MBlock, programação e circuitos."

  if (String(category.title ?? "").trim().toLowerCase() === defaultTitle.toLowerCase()) {
    return NextResponse.json({ error: "A categoria Geral não pode ser arquivada." }, { status: 400 })
  }

  const [defaultCategory] = await db`
    WITH existing AS (
      SELECT id
      FROM public.teacher_project_categories
      WHERE locale = ${categoryLocale}
        AND title = ${defaultTitle}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    ),
    inserted AS (
      INSERT INTO public.teacher_project_categories (
        locale,
        status,
        title,
        description,
        cover_image_url,
        sort_order,
        created_by,
        updated_by
      )
      SELECT
        ${categoryLocale},
        'active',
        ${defaultTitle},
        ${defaultDescription},
        '/project-general-cover-v2.webp',
        0,
        ${auth.teacherId},
        ${auth.teacherId}
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    )
    SELECT id FROM existing
    UNION ALL
    SELECT id FROM inserted
    LIMIT 1
  `

  const [deleted] = await db`
    UPDATE public.teacher_project_categories
    SET
      status = 'archived',
      deleted_at = NOW(),
      updated_by = ${auth.teacherId},
      updated_at = NOW()
    WHERE id = ${id}
      AND deleted_at IS NULL
    RETURNING id
  `

  if (!deleted) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 })

  await db`
    UPDATE public.teacher_projects
    SET
      category_id = ${defaultCategory?.id ?? null},
      updated_by = ${auth.teacherId},
      updated_at = NOW()
    WHERE category_id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.projects.categories.delete",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project_category", id },
  })

  return NextResponse.json({ success: true })
}
