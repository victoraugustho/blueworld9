import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  canTeacherAccessProject,
  ensureProjectsSchema,
  isUuid,
  loadTeacherScopeData,
  normalizeProjectLocale,
} from "@/lib/projects"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const locale = normalizeProjectLocale(req.nextUrl.searchParams.get("locale") ?? auth.teacher.locale)

  const [project] = await db`
    SELECT
      p.*,
      creator.name AS created_by_name
    FROM public.teacher_projects p
    LEFT JOIN public.teachers creator ON creator.id = p.created_by
    WHERE p.id = ${id}
      AND p.deleted_at IS NULL
      AND p.status = 'published'
    LIMIT 1
  `

  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  const scope = await loadTeacherScopeData(auth.teacherId)
  const canAccess = canTeacherAccessProject(project as any, {
    teacherId: auth.teacherId,
    teacherCountry: auth.teacher.country ? String(auth.teacher.country) : null,
    teacherYears: scope.years,
    teacherClassIds: scope.classIds,
  })
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
