import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import {
  createProjectRevision,
  ensureProjectsSchema,
  normalizeProjectAssets,
  normalizeProjectCountryList,
  normalizeProjectLocale,
  normalizeProjectLinks,
  normalizeProjectStatus,
  normalizeProjectStudentYears,
  normalizeProjectType,
  normalizeProjectUuidList,
  replaceProjectAssets,
  replaceProjectLinks,
} from "@/lib/projects"
import { loadProjectFull } from "@/lib/project-service"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"

function parsePagination(params: URLSearchParams) {
  const pageRaw = Number(params.get("page") ?? 1)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const pageSizeRaw = Number(params.get("page_size") ?? 20)
  const page_size = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(100, Math.floor(pageSizeRaw)) : 20
  const offset = (page - 1) * page_size
  return { page, page_size, offset }
}

export async function GET(req: NextRequest) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const params = req.nextUrl.searchParams
  const { page, page_size, offset } = parsePagination(params)
  const q = String(params.get("q") ?? "").trim()
  const status = String(params.get("status") ?? "").trim()

  const qFilter = q
    ? db`AND (p.title_pt ILIKE ${`%${q}%`} OR p.title_es ILIKE ${`%${q}%`})`
    : db``
  const statusFilter =
    status && (["draft", "published", "archived"] as const).includes(status as any)
      ? db`AND p.status = ${status}`
      : db``

  let count = 0
  let items: any[] = []

  try {
    const [countRow] = await db`
      SELECT COUNT(*)::int AS count
      FROM public.teacher_projects p
      WHERE p.deleted_at IS NULL
        ${qFilter}
        ${statusFilter}
    `
    count = Number(countRow?.count ?? 0)

    items = await db`
      SELECT
        p.id,
        p.locale,
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
        p.created_at,
        p.updated_at,
        creator.name AS created_by_name,
        updater.name AS updated_by_name,
        (SELECT COUNT(*)::int FROM public.teacher_project_assets a WHERE a.project_id = p.id AND a.asset_type = 'gallery_image') AS images_count,
        (SELECT COUNT(*)::int FROM public.teacher_project_assets a WHERE a.project_id = p.id AND a.asset_type = 'document') AS documents_count,
        (SELECT COUNT(*)::int FROM public.teacher_project_links l WHERE l.project_id = p.id) AS links_count,
        (SELECT COUNT(*)::int FROM public.teacher_project_comments c WHERE c.project_id = p.id) AS comments_count
      FROM public.teacher_projects p
      LEFT JOIN public.teachers creator ON creator.id = p.created_by
      LEFT JOIN public.teachers updater ON updater.id = p.updated_by
      WHERE p.deleted_at IS NULL
        ${qFilter}
        ${statusFilter}
      ORDER BY p.updated_at DESC, p.created_at DESC
      LIMIT ${page_size}
      OFFSET ${offset}
    `
  } catch (error) {
    console.error("[admin.projects.GET] full query failed, fallbacking to minimal query", error)
    try {
      const [countRow] = await db`
        SELECT COUNT(*)::int AS count
        FROM public.teacher_projects p
        WHERE p.deleted_at IS NULL
          ${qFilter}
          ${statusFilter}
      `
      count = Number(countRow?.count ?? 0)

      const fallbackRows = await db`
        SELECT p.*, creator.name AS created_by_name, updater.name AS updated_by_name
        FROM public.teacher_projects p
        LEFT JOIN public.teachers creator ON creator.id = p.created_by
        LEFT JOIN public.teachers updater ON updater.id = p.updated_by
        WHERE p.deleted_at IS NULL
          ${qFilter}
          ${statusFilter}
        ORDER BY p.updated_at DESC, p.created_at DESC
        LIMIT ${page_size}
        OFFSET ${offset}
      `

      items = fallbackRows.map((row: any) => ({
        ...row,
        images_count: 0,
        documents_count: 0,
        links_count: 0,
        comments_count: 0,
      }))
    } catch (fallbackError) {
      console.error("[admin.projects.GET] minimal query failed", fallbackError)
      return NextResponse.json(
        {
          error:
            "Nao foi possivel carregar projetos. Verifique se o schema de projetos foi aplicado no banco e tente novamente.",
        },
        { status: 500 },
      )
    }
  }

  const normalizedItems = items.map((item: any) => ({
    ...item,
    cover_image_url: normalizeProjectFileUrl(item.cover_image_url),
  }))

  return NextResponse.json({
    items: normalizedItems,
    page,
    page_size,
    total: count,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const body = await req.json().catch(() => ({}))

  const project_type = normalizeProjectType(body.project_type)
  const locale = normalizeProjectLocale(body.locale)
  const status = normalizeProjectStatus(body.status)
  const titleSingle = String(body.title ?? "").trim()
  const summarySingle = String(body.summary ?? "").trim() || null
  const fallbackTitlePt = String(body.title_pt ?? "").trim()
  const fallbackTitleEs = String(body.title_es ?? "").trim()
  const fallbackSummaryPt = String(body.summary_pt ?? "").trim() || null
  const fallbackSummaryEs = String(body.summary_es ?? "").trim() || null
  const title_pt = titleSingle || fallbackTitlePt
  const title_es = titleSingle || fallbackTitleEs
  const summary_pt = summarySingle ?? fallbackSummaryPt
  const summary_es = summarySingle ?? fallbackSummaryEs
  const cover_image_url = String(body.cover_image_url ?? "").trim() || null
  const published_at =
    status === "published" ? (body.published_at ? new Date(String(body.published_at)) : new Date()) : null

  if (!title_pt || !title_es) {
    return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 })
  }

  const access_scope = body.access_scope === "targeted" ? "targeted" : "all"
  const target_teacher_ids = normalizeProjectUuidList(body.target_teacher_ids)
  const target_class_ids = normalizeProjectUuidList(body.target_class_ids)
  const target_countries = normalizeProjectCountryList(body.target_countries)
  const target_student_years = normalizeProjectStudentYears(body.target_student_years)

  if (
    access_scope === "targeted" &&
    target_teacher_ids.length === 0 &&
    target_class_ids.length === 0 &&
    target_countries.length === 0 &&
    target_student_years.length === 0
  ) {
    return NextResponse.json(
      { error: "Selecione ao menos um destino: professor, turma/ano ou país." },
      { status: 400 },
    )
  }

  const links = normalizeProjectLinks(body.links)
  const galleryImages = normalizeProjectAssets(body.gallery_images, "gallery_image")
  const documents = normalizeProjectAssets(body.documents, "document")

  const [created] = await db`
    INSERT INTO public.teacher_projects (
      project_type,
      locale,
      status,
      title_pt,
      title_es,
      summary_pt,
      summary_es,
      cover_image_url,
      access_scope,
      target_teacher_ids,
      target_countries,
      target_student_years,
      target_class_ids,
      published_at,
      created_by,
      updated_by
    )
    VALUES (
      ${project_type},
      ${locale},
      ${status},
      ${title_pt},
      ${title_es},
      ${summary_pt},
      ${summary_es},
      ${cover_image_url},
      ${access_scope},
      ${access_scope === "targeted" ? target_teacher_ids : null}::uuid[],
      ${access_scope === "targeted" ? target_countries : null}::text[],
      ${access_scope === "targeted" ? target_student_years : null}::smallint[],
      ${access_scope === "targeted" ? target_class_ids : null}::uuid[],
      ${published_at},
      ${auth.teacherId},
      ${auth.teacherId}
    )
    RETURNING id
  `

  const projectId = String(created?.id ?? "")
  if (!projectId) {
    return NextResponse.json({ error: "Falha ao criar projeto." }, { status: 500 })
  }

  await replaceProjectLinks(projectId, links as any)
  await replaceProjectAssets(
    projectId,
    [...(galleryImages as any), ...(documents as any)],
    auth.teacherId,
  )
  await createProjectRevision(projectId, auth.teacherId)

  const full = await loadProjectFull(projectId)

  await writeAuditLog({
    req,
    action: "admin.projects.create",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project", id: projectId },
    metadata: {
      project_type,
      status,
      access_scope,
      target_teacher_ids_count: target_teacher_ids.length,
      target_class_ids_count: target_class_ids.length,
      target_countries_count: target_countries.length,
      target_student_years_count: target_student_years.length,
      images_count: galleryImages.length,
      documents_count: documents.length,
      links_count: links.length,
    },
  })

  return NextResponse.json(full, { status: 201 })
}
