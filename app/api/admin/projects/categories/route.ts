import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import {
  ensureProjectsSchema,
  isProjectCategoryAccessReady,
  normalizeProjectCategoryStatus,
  normalizeProjectLocale,
} from "@/lib/projects"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"
import {
  normalizeProjectCategoryAccessBody,
  validateProjectCategoryAccessPolicy,
  validateProjectCategoryTeachers,
} from "@/lib/project-category-access-server"

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

export async function GET(req: NextRequest) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()

  const params = req.nextUrl.searchParams
  const q = String(params.get("q") ?? "").trim()
  const status = String(params.get("status") ?? "").trim()
  const locale = String(params.get("locale") ?? "").trim()

  const qFilter = q
    ? db`AND (c.title ILIKE ${`%${q}%`} OR COALESCE(c.description, '') ILIKE ${`%${q}%`})`
    : db``
  const statusFilter =
    status === "active" || status === "archived" ? db`AND c.status = ${status}` : db``
  const localeFilter = locale === "pt-BR" || locale === "es" ? db`AND c.locale = ${locale}` : db``

  const accessSelect = categoryAccessReady
    ? db`
        c.access_scope,
        c.target_teacher_ids,
        c.target_countries,
        c.target_locales,
      `
    : db`
        'all'::text AS access_scope,
        ARRAY[]::uuid[] AS target_teacher_ids,
        ARRAY[]::text[] AS target_countries,
        ARRAY[]::text[] AS target_locales,
      `

  const items = await db`
    SELECT
      c.id,
      c.locale,
      c.status,
      c.title,
      c.description,
      c.cover_image_url,
      c.sort_order,
      ${accessSelect}
      c.created_at,
      c.updated_at,
      creator.name AS created_by_name,
      updater.name AS updated_by_name,
      (
        SELECT COUNT(*)::int
        FROM public.teacher_projects p
        WHERE p.category_id = c.id
          AND p.deleted_at IS NULL
      ) AS projects_count
    FROM public.teacher_project_categories c
    LEFT JOIN public.teachers creator ON creator.id = c.created_by
    LEFT JOIN public.teachers updater ON updater.id = c.updated_by
    WHERE c.deleted_at IS NULL
      ${qFilter}
      ${statusFilter}
      ${localeFilter}
    ORDER BY c.sort_order ASC, c.title ASC, c.created_at DESC
  `

  return NextResponse.json({
    items: items.map((item: any) => ({
      ...item,
      cover_image_url: normalizeProjectFileUrl(item.cover_image_url),
    })),
    total: items.length,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()

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

  const [created] = await db`
    INSERT INTO public.teacher_project_categories (
      locale,
      status,
      title,
      description,
      cover_image_url,
      sort_order,
      access_scope,
      target_teacher_ids,
      target_countries,
      target_locales,
      created_by,
      updated_by
    )
    VALUES (
      ${payload.locale},
      ${payload.status},
      ${payload.title},
      ${payload.description},
      ${payload.cover_image_url},
      ${payload.sort_order},
      ${accessPolicy.access_scope},
      ${accessPolicy.target_teacher_ids}::uuid[],
      ${accessPolicy.target_countries}::text[],
      ${accessPolicy.target_locales}::text[],
      ${auth.teacherId},
      ${auth.teacherId}
    )
    RETURNING id
  `

  const categoryId = String(created?.id ?? "")

  await writeAuditLog({
    req,
    action: "admin.projects.categories.create",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project_category", id: categoryId },
    metadata: { ...payload, ...accessPolicy },
  })

  return NextResponse.json({ id: categoryId, ...payload, ...accessPolicy }, { status: 201 })
}
