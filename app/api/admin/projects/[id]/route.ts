import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import {
  createProjectRevision,
  ensureProjectsSchema,
  isUuid,
  normalizeProjectCategoryId,
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

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const full = await loadProjectFull(id)
  if (!full) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  return NextResponse.json(full)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const [exists] = await db`
    SELECT id, title_pt, title_es, summary_pt, summary_es
    FROM public.teacher_projects
    WHERE id = ${id}
      AND deleted_at IS NULL
    LIMIT 1
  `
  if (!exists) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  const project_type = normalizeProjectType(body.project_type)
  const category_id = normalizeProjectCategoryId(body.category_id)
  const locale = normalizeProjectLocale(body.locale)
  const status = normalizeProjectStatus(body.status)
  const titleSingle = String(body.title ?? "").trim()
  const summarySingle = String(body.summary ?? "").trim() || null
  const fallbackTitlePt = String(body.title_pt ?? "").trim()
  const fallbackTitleEs = String(body.title_es ?? "").trim()
  const fallbackSummaryPt = String(body.summary_pt ?? "").trim() || null
  const fallbackSummaryEs = String(body.summary_es ?? "").trim() || null
  const existingTitleByLocale = String(locale === "es" ? exists?.title_es ?? "" : exists?.title_pt ?? "").trim()
  const existingSummaryByLocale = String(locale === "es" ? exists?.summary_es ?? "" : exists?.summary_pt ?? "").trim()
  const selectedTitle =
    titleSingle ||
    (locale === "es" ? fallbackTitleEs : fallbackTitlePt) ||
    existingTitleByLocale
  const selectedSummary =
    summarySingle ??
    (locale === "es" ? fallbackSummaryEs : fallbackSummaryPt) ??
    (existingSummaryByLocale || null)

  const title_pt =
    locale === "pt-BR"
      ? selectedTitle
      : String(fallbackTitlePt || exists?.title_pt || selectedTitle).trim()
  const title_es =
    locale === "es"
      ? selectedTitle
      : String(fallbackTitleEs || exists?.title_es || selectedTitle).trim()
  const summary_pt =
    locale === "pt-BR"
      ? selectedSummary
      : (fallbackSummaryPt ?? exists?.summary_pt ?? selectedSummary)
  const summary_es =
    locale === "es"
      ? selectedSummary
      : (fallbackSummaryEs ?? exists?.summary_es ?? selectedSummary)
  const cover_image_url = String(body.cover_image_url ?? "").trim() || null
  const published_at =
    status === "published" ? (body.published_at ? new Date(String(body.published_at)) : new Date()) : null

  if (!selectedTitle || !title_pt || !title_es) {
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

  if (category_id) {
    const [category] = await db`
      SELECT id
      FROM public.teacher_project_categories
      WHERE id = ${category_id}
        AND locale = ${locale}
        AND status = 'active'
        AND deleted_at IS NULL
      LIMIT 1
    `
    if (!category) {
      return NextResponse.json({ error: "Categoria inválida para o idioma selecionado." }, { status: 400 })
    }
  }

  await db`
    UPDATE public.teacher_projects
    SET
      category_id = ${category_id},
      project_type = ${project_type},
      locale = ${locale},
      status = ${status},
      title_pt = ${title_pt},
      title_es = ${title_es},
      summary_pt = ${summary_pt},
      summary_es = ${summary_es},
      cover_image_url = ${cover_image_url},
      access_scope = ${access_scope},
      target_teacher_ids = ${access_scope === "targeted" ? target_teacher_ids : null}::uuid[],
      target_countries = ${access_scope === "targeted" ? target_countries : null}::text[],
      target_student_years = ${access_scope === "targeted" ? target_student_years : null}::smallint[],
      target_class_ids = ${access_scope === "targeted" ? target_class_ids : null}::uuid[],
      published_at = ${published_at},
      updated_by = ${auth.teacherId},
      updated_at = NOW()
    WHERE id = ${id}
  `

  await replaceProjectLinks(id, links as any)
  await replaceProjectAssets(id, [...(galleryImages as any), ...(documents as any)], auth.teacherId)
  await createProjectRevision(id, auth.teacherId)

  const full = await loadProjectFull(id)

  await writeAuditLog({
    req,
    action: "admin.projects.update",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project", id },
    metadata: {
      project_type,
      category_id,
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

  return NextResponse.json(full)
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const [deleted] = await db`
    UPDATE public.teacher_projects
    SET
      status = 'archived',
      deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = ${auth.teacherId}
    WHERE id = ${id}
      AND deleted_at IS NULL
    RETURNING id
  `

  if (!deleted) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  await writeAuditLog({
    req,
    action: "admin.projects.delete",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project", id },
  })

  return NextResponse.json({ success: true })
}
