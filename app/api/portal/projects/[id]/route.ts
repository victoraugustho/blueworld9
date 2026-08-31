import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  canTeacherAccessProject,
  ensureProjectsSchema,
  isUuid,
  isProjectCategoryAccessReady,
  loadTeacherScopeData,
  normalizeProjectLocale,
} from "@/lib/projects"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"
import { canTeacherAccessProjectWithCategory } from "@/lib/project-category-access"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  let project: any = null
  try {
    const categoryAccessSelect = categoryAccessReady
      ? db`
          category.access_scope AS category_access_scope,
          category.target_teacher_ids AS category_target_teacher_ids,
          category.target_countries AS category_target_countries,
          category.target_locales AS category_target_locales
        `
      : db`
          'all'::text AS category_access_scope,
          ARRAY[]::uuid[] AS category_target_teacher_ids,
          ARRAY[]::text[] AS category_target_countries,
          ARRAY[]::text[] AS category_target_locales
        `
    ;[project] = await db`
      SELECT
        p.*,
        creator.name AS created_by_name,
        category.title AS category_title,
        category.description AS category_description,
        category.cover_image_url AS category_cover_image_url,
        ${categoryAccessSelect}
      FROM public.teacher_projects p
      LEFT JOIN public.teachers creator ON creator.id = p.created_by
      LEFT JOIN public.teacher_project_categories category
        ON category.id = p.category_id
        AND category.status = 'active'
        AND category.deleted_at IS NULL
      WHERE p.id = ${id}
        AND p.deleted_at IS NULL
        AND p.status = 'published'
      LIMIT 1
    `
  } catch (error) {
    console.error("[portal.projects.detail] category join failed", error)
    if (categoryAccessReady) throw error
    ;[project] = await db`
      SELECT
        p.*,
        creator.name AS created_by_name,
        NULL::text AS category_title,
        NULL::text AS category_description,
        NULL::text AS category_cover_image_url,
        'all'::text AS category_access_scope,
        ARRAY[]::uuid[] AS category_target_teacher_ids,
        ARRAY[]::text[] AS category_target_countries,
        ARRAY[]::text[] AS category_target_locales
      FROM public.teacher_projects p
      LEFT JOIN public.teachers creator ON creator.id = p.created_by
      WHERE p.id = ${id}
        AND p.deleted_at IS NULL
        AND p.status = 'published'
      LIMIT 1
    `
  }

  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  const locale = normalizeProjectLocale(project.locale)

  const scope = await loadTeacherScopeData(auth.teacherId)
  const canAccess = canTeacherAccessProjectWithCategory(
    project,
    {
      access_scope: project.category_access_scope,
      target_teacher_ids: project.category_target_teacher_ids,
      target_countries: project.category_target_countries,
      target_locales: project.category_target_locales,
    },
    {
      id: auth.teacherId,
      country: auth.teacher.country ? String(auth.teacher.country) : null,
      locale: auth.teacher.locale,
      years: scope.years,
      classIds: scope.classIds,
    },
    canTeacherAccessProject,
  )
  if (!canAccess) return NextResponse.json({ error: "Sem permissão para visualizar este projeto." }, { status: 403 })

  const assets = await db`
    SELECT
      id,
      asset_type,
      locale,
      title_pt,
      title_es,
      description_pt,
      description_es,
      file_name,
      file_url,
      mime_type,
      size_bytes,
      sort_order
    FROM public.teacher_project_assets
    WHERE project_id = ${id}
    ORDER BY asset_type ASC, sort_order ASC, created_at ASC
  `

  const links = await db`
    SELECT
      id,
      title_pt,
      title_es,
      url,
      description_pt,
      description_es,
      sort_order
    FROM public.teacher_project_links
    WHERE project_id = ${id}
    ORDER BY sort_order ASC, created_at ASC
  `

  const [teacherNote] = await db`
    SELECT note, updated_at
    FROM public.teacher_project_teacher_notes
    WHERE project_id = ${id}
      AND teacher_id = ${auth.teacherId}
    LIMIT 1
  `

  return NextResponse.json({
    ...project,
    locale,
    title: locale === "es" ? String(project.title_es ?? "") : String(project.title_pt ?? ""),
    summary: locale === "es" ? String(project.summary_es ?? "") : String(project.summary_pt ?? ""),
    introduction: locale === "es" ? String(project.summary_es ?? "") : String(project.summary_pt ?? ""),
    cover_image_url: normalizeProjectFileUrl(project.cover_image_url),
    category_title: project.category_title ? String(project.category_title ?? "") : null,
    category_description: project.category_title ? String(project.category_description ?? "") : null,
    category_cover_image_url: project.category_title ? normalizeProjectFileUrl(project.category_cover_image_url) : null,
    gallery_images: assets
      .filter((item: any) => String(item.asset_type) === "gallery_image")
      .map((item: any) => ({ ...item, file_url: normalizeProjectFileUrl(item.file_url) })),
    documents: assets
      .filter((item: any) => String(item.asset_type) === "document")
      .map((item: any) => ({ ...item, file_url: normalizeProjectFileUrl(item.file_url) })),
    links: links.map((link: any) => ({
      ...link,
      title: locale === "es" ? String(link.title_es ?? "") : String(link.title_pt ?? ""),
      description: locale === "es" ? String(link.description_es ?? "") : String(link.description_pt ?? ""),
    })),
    teacher_note: teacherNote?.note ?? "",
    teacher_note_updated_at: teacherNote?.updated_at ?? null,
  })
}
