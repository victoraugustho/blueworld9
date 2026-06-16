import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { canTeacherAccessProject, ensureProjectsSchema, loadTeacherScopeData, normalizeProjectLocale } from "@/lib/projects"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

function parsePagination(params: URLSearchParams) {
  const pageRaw = Number(params.get("page") ?? 1)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const pageSizeRaw = Number(params.get("page_size") ?? 20)
  const page_size = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(100, Math.floor(pageSizeRaw)) : 20
  const offset = (page - 1) * page_size
  return { page, page_size, offset }
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const params = req.nextUrl.searchParams
  const { page, page_size, offset } = parsePagination(params)
  const locale = normalizeProjectLocale(await getEffectivePortalLocale(auth.teacher))
  const q = String(params.get("q") ?? "").trim()

  const qFilter = q
    ? db`AND (
      p.title_pt ILIKE ${`%${q}%`}
      OR p.title_es ILIKE ${`%${q}%`}
      OR COALESCE(p.summary_pt, '') ILIKE ${`%${q}%`}
      OR COALESCE(p.summary_es, '') ILIKE ${`%${q}%`}
    )`
    : db``

  const [{ exists: hasProjectLinks } = { exists: false }] = await db`
    SELECT to_regclass('public.teacher_project_links') IS NOT NULL AS exists
  `
  const linksCountSelect = hasProjectLinks
    ? db`(
        SELECT COUNT(*)::int
        FROM public.teacher_project_links l
        WHERE l.project_id = p.id
      ) AS links_count`
    : db`0::int AS links_count`

  let rows: any[] = []
  try {
    rows = await db`
      SELECT
        p.id,
        p.category_id,
        p.project_type,
        p.locale AS project_locale,
        p.status,
        p.title_pt,
        p.title_es,
        p.summary_pt,
        p.summary_es,
        p.cover_image_url,
        p.access_scope,
        p.target_teacher_ids,
        p.target_countries,
        p.target_student_years,
        p.target_class_ids,
        p.published_at,
        p.updated_at,
        p.created_at,
        creator.name AS created_by_name,
        category.title AS category_title,
        category.description AS category_description,
        category.cover_image_url AS category_cover_image_url,
        category.sort_order AS category_sort_order,
        (
          SELECT COUNT(*)::int
          FROM public.teacher_project_assets a
          WHERE a.project_id = p.id
            AND a.asset_type = 'gallery_image'
        ) AS images_count,
        (
          SELECT COUNT(*)::int
          FROM public.teacher_project_assets a
          WHERE a.project_id = p.id
            AND a.asset_type = 'document'
        ) AS documents_count,
        ${linksCountSelect}
      FROM public.teacher_projects p
      LEFT JOIN public.teachers creator ON creator.id = p.created_by
      LEFT JOIN public.teacher_project_categories category
        ON category.id = p.category_id
        AND category.status = 'active'
        AND category.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
        AND p.status = 'published'
        AND COALESCE(p.locale, 'pt-BR') = ${locale}
        ${qFilter}
      ORDER BY COALESCE(p.published_at, p.updated_at, p.created_at) DESC
    `
  } catch (error) {
    console.error("[portal.projects.GET] category query failed, using project-only fallback", error)
    rows = await db`
      SELECT
        p.id,
        NULL::uuid AS category_id,
        p.project_type,
        p.locale AS project_locale,
        p.status,
        p.title_pt,
        p.title_es,
        p.summary_pt,
        p.summary_es,
        p.cover_image_url,
        p.access_scope,
        p.target_teacher_ids,
        p.target_countries,
        p.target_student_years,
        p.target_class_ids,
        p.published_at,
        p.updated_at,
        p.created_at,
        creator.name AS created_by_name,
        NULL::text AS category_title,
        NULL::text AS category_description,
        NULL::text AS category_cover_image_url,
        999999::int AS category_sort_order,
        (
          SELECT COUNT(*)::int
          FROM public.teacher_project_assets a
          WHERE a.project_id = p.id
            AND a.asset_type = 'gallery_image'
        ) AS images_count,
        (
          SELECT COUNT(*)::int
          FROM public.teacher_project_assets a
          WHERE a.project_id = p.id
            AND a.asset_type = 'document'
        ) AS documents_count,
        ${linksCountSelect}
      FROM public.teacher_projects p
      LEFT JOIN public.teachers creator ON creator.id = p.created_by
      WHERE p.deleted_at IS NULL
        AND p.status = 'published'
        AND COALESCE(p.locale, 'pt-BR') = ${locale}
        ${qFilter}
      ORDER BY COALESCE(p.published_at, p.updated_at, p.created_at) DESC
    `
  }

  const scope = await loadTeacherScopeData(auth.teacherId)
  const visible = rows.filter((item: any) =>
    canTeacherAccessProject(item, {
      teacherId: auth.teacherId,
      teacherCountry: auth.teacher.country ? String(auth.teacher.country) : null,
      teacherYears: scope.years,
      teacherClassIds: scope.classIds,
    }),
  )

  const total = visible.length
  const paginated = visible.slice(offset, offset + page_size).map((item: any) => ({
    ...item,
    title: locale === "es" ? String(item.title_es ?? "") : String(item.title_pt ?? ""),
    summary: locale === "es" ? String(item.summary_es ?? "") : String(item.summary_pt ?? ""),
    locale,
    cover_image_url: normalizeProjectFileUrl(item.cover_image_url),
    images_count: Number(item.images_count ?? 0),
    documents_count: Number(item.documents_count ?? 0),
    links_count: Number(item.links_count ?? 0),
    category_id: item.category_title ? item.category_id : null,
    category_title: item.category_title ? String(item.category_title ?? "") : null,
    category_description: item.category_title ? String(item.category_description ?? "") : null,
    category_cover_image_url: item.category_title ? normalizeProjectFileUrl(item.category_cover_image_url) : null,
    category_sort_order: item.category_title ? Number(item.category_sort_order ?? 0) : 999999,
  }))

  return NextResponse.json({
    items: paginated,
    total,
    page,
    page_size,
  })
}
