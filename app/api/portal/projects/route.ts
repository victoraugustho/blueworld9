import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { canTeacherAccessProject, ensureProjectsSchema, loadTeacherScopeData, normalizeProjectLocale } from "@/lib/projects"

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
  const locale = normalizeProjectLocale(params.get("locale") ?? auth.teacher.locale)
  const q = String(params.get("q") ?? "").trim()

  const qFilter = q
    ? db`AND (
      p.title_pt ILIKE ${`%${q}%`}
      OR p.title_es ILIKE ${`%${q}%`}
      OR COALESCE(p.summary_pt, '') ILIKE ${`%${q}%`}
      OR COALESCE(p.summary_es, '') ILIKE ${`%${q}%`}
    )`
    : db``

  const rows = await db`
    SELECT
      p.id,
      p.project_type,
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
      ) AS documents_count
    FROM public.teacher_projects p
    LEFT JOIN public.teachers creator ON creator.id = p.created_by
    WHERE p.deleted_at IS NULL
      AND p.status = 'published'
      AND (p.locale IS NULL OR p.locale = ${locale})
      ${qFilter}
    ORDER BY COALESCE(p.published_at, p.updated_at, p.created_at) DESC
  `

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
  }))

  return NextResponse.json({
    items: paginated,
    total,
    page,
    page_size,
  })
}
