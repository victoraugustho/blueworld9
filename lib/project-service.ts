import { db } from "@/lib/db"
import {
  createProjectRevision,
  normalizeProjectLocale,
  normalizeProjectAssets,
  normalizeProjectLinks,
  normalizeProjectStatus,
  normalizeProjectType,
  replaceProjectAssets,
  replaceProjectLinks,
  type ProjectAssetType,
} from "@/lib/projects"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"

export async function loadProjectFull(projectId: string) {
  const [project] = await db`
    SELECT
      p.*,
      creator.name AS created_by_name,
      updater.name AS updated_by_name
    FROM public.teacher_projects p
    LEFT JOIN public.teachers creator ON creator.id = p.created_by
    LEFT JOIN public.teachers updater ON updater.id = p.updated_by
    WHERE p.id = ${projectId}
      AND p.deleted_at IS NULL
    LIMIT 1
  `
  if (!project) return null

  const assets = await db`
    SELECT
      id,
      project_id,
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
      sort_order,
      uploaded_by,
      created_at
    FROM public.teacher_project_assets
    WHERE project_id = ${projectId}
    ORDER BY asset_type ASC, sort_order ASC, created_at ASC
  `

  const links = await db`
    SELECT
      id,
      project_id,
      title_pt,
      title_es,
      url,
      description_pt,
      description_es,
      sort_order,
      created_at
    FROM public.teacher_project_links
    WHERE project_id = ${projectId}
    ORDER BY sort_order ASC, created_at ASC
  `

  const commentsCountRows = await db`
    SELECT COUNT(*)::int AS count
    FROM public.teacher_project_comments
    WHERE project_id = ${projectId}
  `

  const comments_count = Number(commentsCountRows?.[0]?.count ?? 0)

  return {
    ...project,
    cover_image_url: normalizeProjectFileUrl(project.cover_image_url),
    gallery_images: assets
      .filter((item: any) => String(item.asset_type) === "gallery_image")
      .map((item: any) => ({ ...item, file_url: normalizeProjectFileUrl(item.file_url) })),
    documents: assets
      .filter((item: any) => String(item.asset_type) === "document")
      .map((item: any) => ({ ...item, file_url: normalizeProjectFileUrl(item.file_url) })),
    links,
    comments_count,
  }
}

export async function applyProjectSnapshotFromRevision(projectId: string, revisionId: string, updatedBy: string) {
  const [revision] = await db`
    SELECT id, snapshot, revision_number
    FROM public.teacher_project_revisions
    WHERE id = ${revisionId}
      AND project_id = ${projectId}
    LIMIT 1
  `
  if (!revision) return { ok: false as const, error: "Revisão não encontrada." }

  let snapshot: any = revision.snapshot ?? {}
  if (typeof snapshot === "string") {
    try {
      snapshot = JSON.parse(snapshot)
    } catch {
      snapshot = {}
    }
  }
  const project = snapshot?.project ?? null
  if (!project || typeof project !== "object") {
    return { ok: false as const, error: "Snapshot da revisão está inválido." }
  }

  const projectType = normalizeProjectType(project.project_type)
  const locale = normalizeProjectLocale(project.locale)
  const status = normalizeProjectStatus(project.status)
  const links = normalizeProjectLinks(snapshot?.links ?? [])
  const galleryImages = normalizeProjectAssets(
    (snapshot?.assets ?? []).filter((item: any) => String(item?.asset_type) === "gallery_image"),
    "gallery_image",
  )
  const documents = normalizeProjectAssets(
    (snapshot?.assets ?? []).filter((item: any) => String(item?.asset_type) === "document"),
    "document",
  )

  const targetTeacherIds = Array.isArray(project.target_teacher_ids) ? project.target_teacher_ids : null
  const targetCountries = Array.isArray(project.target_countries) ? project.target_countries : null
  const targetStudentYears = Array.isArray(project.target_student_years) ? project.target_student_years : null
  const targetClassIds = Array.isArray(project.target_class_ids) ? project.target_class_ids : null
  const accessScope = project.access_scope === "targeted" ? "targeted" : "all"

  await db`
    UPDATE public.teacher_projects
    SET
      project_type = ${projectType},
      locale = ${locale},
      status = ${status},
      title_pt = ${String(project.title_pt ?? "").trim()},
      title_es = ${String(project.title_es ?? "").trim()},
      summary_pt = ${project.summary_pt ? String(project.summary_pt) : null},
      summary_es = ${project.summary_es ? String(project.summary_es) : null},
      cover_image_url = ${project.cover_image_url ? String(project.cover_image_url) : null},
      access_scope = ${accessScope},
      target_teacher_ids = ${targetTeacherIds}::uuid[],
      target_countries = ${targetCountries}::text[],
      target_student_years = ${targetStudentYears}::smallint[],
      target_class_ids = ${targetClassIds}::uuid[],
      published_at = ${project.published_at ? new Date(String(project.published_at)) : null},
      updated_by = ${updatedBy},
      updated_at = NOW()
    WHERE id = ${projectId}
  `

  await replaceProjectLinks(projectId, links as any)
  const allAssets = [...galleryImages, ...documents] as Array<{
    asset_type: ProjectAssetType
    locale: "pt-BR" | "es"
    title_pt: string | null
    title_es: string | null
    description_pt: string | null
    description_es: string | null
    file_name: string
    file_url: string
    mime_type: string
    size_bytes: number
    sort_order: number
  }>
  await replaceProjectAssets(projectId, allAssets, updatedBy)
  await createProjectRevision(projectId, updatedBy)

  return {
    ok: true as const,
    revision_number: Number(revision.revision_number ?? 0),
  }
}
