import { db } from "@/lib/db"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"
import { isValidStudentYear } from "@/lib/turma-years"

export const PROJECT_LOCALES = ["pt-BR", "es"] as const
export const PROJECT_STATUSES = ["draft", "published", "archived"] as const
export const PROJECT_TYPES = ["arduino_mblock", "programming", "custom"] as const
export const PROJECT_ASSET_TYPES = ["gallery_image", "document"] as const
export const PROJECT_COUNTRIES = ["BR", "UY", "PY"] as const

export type ProjectLocale = (typeof PROJECT_LOCALES)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectType = (typeof PROJECT_TYPES)[number]
export type ProjectAssetType = (typeof PROJECT_ASSET_TYPES)[number]
export type ProjectCountry = (typeof PROJECT_COUNTRIES)[number]

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}


export function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  )
}

function normalizeText(value: unknown, max = 60000) {
  const text = String(value ?? "").trim()
  if (!text) return ""
  return text.length > max ? text.slice(0, max) : text
}

function normalizeOptionalText(value: unknown, max = 60000) {
  const text = normalizeText(value, max)
  return text || null
}

export function normalizeProjectLocale(value: unknown): ProjectLocale {
  return value === "es" ? "es" : "pt-BR"
}

export function normalizeProjectAssetLocale(value: unknown): ProjectLocale {
  return value === "es" ? "es" : "pt-BR"
}

export function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (value === "published") return "published"
  if (value === "archived") return "archived"
  return "draft"
}

export function normalizeProjectType(value: unknown): ProjectType {
  if (value === "programming") return "programming"
  if (value === "custom") return "custom"
  return "arduino_mblock"
}

export function normalizeProjectCountryList(value: unknown) {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter((item): item is ProjectCountry => (PROJECT_COUNTRIES as readonly string[]).includes(item))
  return Array.from(new Set(normalized))
}

export function normalizeProjectStudentYears(value: unknown) {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && isValidStudentYear(item))
  return Array.from(new Set(normalized)).sort((a, b) => a - b)
}

export function normalizeProjectUuidList(value: unknown) {
  const source = Array.isArray(value) ? value : []
  const normalized = source
    .map((item) => String(item ?? "").trim())
    .filter((item) => isUuid(item))
  return Array.from(new Set(normalized))
}

export function normalizeProjectLinks(value: unknown) {
  const source = Array.isArray(value) ? value : []
  return source
    .map((item) => {
      if (!isObject(item)) return null
      const locale = normalizeProjectAssetLocale(item.locale)
      const titleSingle = normalizeText(item.title, 250)
      const titlePtRaw = normalizeText(item.title_pt, 250)
      const titleEsRaw = normalizeText(item.title_es, 250)
      const url = normalizeText(item.url, 1200)
      const localizedTitle =
        locale === "es"
          ? titleEsRaw || titleSingle || titlePtRaw
          : titlePtRaw || titleSingle || titleEsRaw
      if (!localizedTitle || !url) return null

      const title_pt = titlePtRaw || localizedTitle
      const title_es = titleEsRaw || localizedTitle

      const descriptionSingle = normalizeOptionalText(item.description, 4000)
      const descriptionPtRaw = normalizeOptionalText(item.description_pt, 4000)
      const descriptionEsRaw = normalizeOptionalText(item.description_es, 4000)

      const description_pt =
        locale === "pt-BR"
          ? descriptionPtRaw ?? descriptionSingle
          : descriptionPtRaw
      const description_es =
        locale === "es"
          ? descriptionEsRaw ?? descriptionSingle
          : descriptionEsRaw

      return {
        id: isUuid(item.id) ? String(item.id) : null,
        title_pt,
        title_es,
        url,
        description_pt,
        description_es,
        sort_order: Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      }
    })
    .filter(Boolean)
}

export function normalizeProjectAssets(value: unknown, expectedType: ProjectAssetType) {
  const source = Array.isArray(value) ? value : []
  return source
    .map((item) => {
      if (!isObject(item)) return null
      const assetTypeRaw = String(item.asset_type ?? "").trim()
      const asset_type =
        assetTypeRaw === "gallery_image" || assetTypeRaw === "document"
          ? (assetTypeRaw as ProjectAssetType)
          : expectedType
      if (asset_type !== expectedType) return null

      const file_url = normalizeText(item.file_url, 1200)
      const file_name = normalizeText(item.file_name, 400)
      const mime_type = normalizeText(item.mime_type, 200)
      const size_bytes = Number(item.size_bytes ?? 0)

      if (!file_url || !file_name || !mime_type || !Number.isFinite(size_bytes) || size_bytes <= 0) return null

      return {
        id: isUuid(item.id) ? String(item.id) : null,
        asset_type,
        locale: normalizeProjectAssetLocale(item.locale),
        title_pt: normalizeOptionalText(item.title_pt, 250),
        title_es: normalizeOptionalText(item.title_es, 250),
        description_pt: normalizeOptionalText(item.description_pt, 4000),
        description_es: normalizeOptionalText(item.description_es, 4000),
        file_name,
        file_url,
        mime_type,
        size_bytes,
        sort_order: Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      }
    })
    .filter(Boolean)
}

export function getProjectUploadLimits() {
  const imageLimitMbRaw = Number(process.env.PROJECT_MAX_IMAGE_MB ?? 20)
  const documentLimitMbRaw = Number(process.env.PROJECT_MAX_DOCUMENT_MB ?? 50)
  const imageLimitMb = Number.isFinite(imageLimitMbRaw) && imageLimitMbRaw > 0 ? imageLimitMbRaw : 20
  const documentLimitMb = Number.isFinite(documentLimitMbRaw) && documentLimitMbRaw > 0 ? documentLimitMbRaw : 50
  return {
    imageBytes: Math.floor(imageLimitMb * 1024 * 1024),
    documentBytes: Math.floor(documentLimitMb * 1024 * 1024),
    imageLimitMb,
    documentLimitMb,
  }
}

export function canTeacherAccessProject(
  project: {
    access_scope: string
    target_teacher_ids?: string[] | null
    target_countries?: string[] | null
    target_student_years?: number[] | null
    target_class_ids?: string[] | null
  },
  params: {
    teacherId: string
    teacherCountry: string | null
    teacherYears: number[]
    teacherClassIds: string[]
  },
) {
  if (project.access_scope === "all") return true

  const teacherTarget = Array.isArray(project.target_teacher_ids) ? project.target_teacher_ids : []
  if (teacherTarget.includes(params.teacherId)) return true

  if (params.teacherCountry) {
    const countryTarget = Array.isArray(project.target_countries) ? project.target_countries : []
    if (countryTarget.includes(params.teacherCountry)) return true
  }

  const yearTarget = Array.isArray(project.target_student_years) ? project.target_student_years : []
  if (yearTarget.some((item) => params.teacherYears.includes(Number(item)))) return true

  const classTarget = Array.isArray(project.target_class_ids) ? project.target_class_ids : []
  if (classTarget.some((item) => params.teacherClassIds.includes(item))) return true

  return false
}

export async function loadTeacherScopeData(teacherId: string) {
  const classes = await db`
    SELECT DISTINCT id::text AS id, student_year
    FROM public.teacher_classes
    WHERE teacher_id = ${teacherId}
      AND active = TRUE
  `

  const classIds = classes.map((row: any) => String(row.id))
  const years = classes
    .map((row: any) => Number(row.student_year))
    .filter((value: number) => Number.isInteger(value) && isValidStudentYear(value))

  return {
    classIds: Array.from(new Set(classIds)),
    years: Array.from(new Set(years)).sort((a, b) => a - b),
  }
}


export async function replaceProjectLinks(
  projectId: string,
  links: Array<{
    title_pt: string
    title_es: string
    url: string
    description_pt: string | null
    description_es: string | null
    sort_order: number
  }>,
) {
  await db`
    DELETE FROM public.teacher_project_links
    WHERE project_id = ${projectId}
  `

  if (links.length === 0) return

  const projectIds = links.map(() => projectId)
  const titlesPt = links.map((item) => item.title_pt)
  const titlesEs = links.map((item) => item.title_es)
  const urls = links.map((item) => item.url)
  const descriptionsPt = links.map((item) => item.description_pt)
  const descriptionsEs = links.map((item) => item.description_es)
  const sortOrders = links.map((item) => item.sort_order)

  await db`
    INSERT INTO public.teacher_project_links (
      project_id,
      title_pt,
      title_es,
      url,
      description_pt,
      description_es,
      sort_order
    )
    SELECT
      UNNEST(${projectIds}::uuid[]),
      UNNEST(${titlesPt}::text[]),
      UNNEST(${titlesEs}::text[]),
      UNNEST(${urls}::text[]),
      UNNEST(${descriptionsPt}::text[]),
      UNNEST(${descriptionsEs}::text[]),
      UNNEST(${sortOrders}::int[])
  `
}

export async function replaceProjectAssets(
  projectId: string,
  assets: Array<{
    asset_type: ProjectAssetType
    locale: ProjectLocale
    title_pt: string | null
    title_es: string | null
    description_pt: string | null
    description_es: string | null
    file_name: string
    file_url: string
    mime_type: string
    size_bytes: number
    sort_order: number
  }>,
  teacherId: string,
) {
  await db`
    DELETE FROM public.teacher_project_assets
    WHERE project_id = ${projectId}
  `

  if (assets.length === 0) return

  const projectIds = assets.map(() => projectId)
  const assetTypes = assets.map((item) => item.asset_type)
  const locales = assets.map((item) => item.locale)
  const titlesPt = assets.map((item) => item.title_pt)
  const titlesEs = assets.map((item) => item.title_es)
  const descriptionsPt = assets.map((item) => item.description_pt)
  const descriptionsEs = assets.map((item) => item.description_es)
  const fileNames = assets.map((item) => item.file_name)
  const fileUrls = assets.map((item) => item.file_url)
  const mimeTypes = assets.map((item) => item.mime_type)
  const sizeBytes = assets.map((item) => item.size_bytes)
  const sortOrders = assets.map((item) => item.sort_order)
  const uploadedBy = assets.map(() => teacherId)

  await db`
    INSERT INTO public.teacher_project_assets (
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
      uploaded_by
    )
    SELECT
      UNNEST(${projectIds}::uuid[]),
      UNNEST(${assetTypes}::text[]),
      UNNEST(${locales}::text[]),
      UNNEST(${titlesPt}::text[]),
      UNNEST(${titlesEs}::text[]),
      UNNEST(${descriptionsPt}::text[]),
      UNNEST(${descriptionsEs}::text[]),
      UNNEST(${fileNames}::text[]),
      UNNEST(${fileUrls}::text[]),
      UNNEST(${mimeTypes}::text[]),
      UNNEST(${sizeBytes}::bigint[]),
      UNNEST(${sortOrders}::int[]),
      UNNEST(${uploadedBy}::uuid[])
  `
}

async function buildProjectSnapshot(projectId: string) {
  const [project] = await db`
    SELECT *
    FROM public.teacher_projects
    WHERE id = ${projectId}
    LIMIT 1
  `
  if (!project) return null

  const assets = await db`
    SELECT *
    FROM public.teacher_project_assets
    WHERE project_id = ${projectId}
    ORDER BY asset_type ASC, sort_order ASC, created_at ASC
  `

  const links = await db`
    SELECT *
    FROM public.teacher_project_links
    WHERE project_id = ${projectId}
    ORDER BY sort_order ASC, created_at ASC
  `

  return {
    project,
    assets,
    links,
  }
}

export async function createProjectRevision(projectId: string, createdBy: string | null) {
  const snapshot = await buildProjectSnapshot(projectId)
  if (!snapshot) return null

  const [meta] = await db`
    SELECT
      COALESCE(
        (SELECT MAX(revision_number) FROM public.teacher_project_revisions WHERE project_id = ${projectId}),
        0
      )::int AS last_revision
  `

  const revisionNumber = Number(meta?.last_revision ?? 0) + 1
  const payload = JSON.stringify(snapshot)

  const [revision] = await db`
    INSERT INTO public.teacher_project_revisions (
      project_id,
      revision_number,
      snapshot,
      created_by
    )
    VALUES (
      ${projectId},
      ${revisionNumber},
      ${payload}::jsonb,
      ${createdBy}
    )
    RETURNING id, project_id, revision_number, created_at
  `

  return revision
}

export async function ensureProjectsSchema() {
  await ensureRuntimeSchema("schema:projects:v4", async () => {
    await db`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_type TEXT NOT NULL DEFAULT 'arduino_mblock',
        locale TEXT NOT NULL DEFAULT 'pt-BR',
        status TEXT NOT NULL DEFAULT 'draft',
        title_pt TEXT NOT NULL,
        title_es TEXT NOT NULL,
        summary_pt TEXT NULL,
        summary_es TEXT NULL,
        cover_image_url TEXT NULL,
        access_scope TEXT NOT NULL DEFAULT 'all',
        target_teacher_ids UUID[] NULL,
        target_countries TEXT[] NULL,
        target_student_years SMALLINT[] NULL,
        target_class_ids UUID[] NULL,
        published_at TIMESTAMPTZ NULL,
        created_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
        updated_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL
      )
    `

    await db`
      ALTER TABLE public.teacher_projects
      ADD COLUMN IF NOT EXISTS locale TEXT NULL
    `

    await db`
      ALTER TABLE public.teacher_projects
      ALTER COLUMN locale SET DEFAULT 'pt-BR'
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'teacher_projects_type_check'
        ) THEN
          ALTER TABLE public.teacher_projects
            ADD CONSTRAINT teacher_projects_type_check
            CHECK (project_type IN ('arduino_mblock', 'programming', 'custom'));
        END IF;
      END
      $$;
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'teacher_projects_status_check'
        ) THEN
          ALTER TABLE public.teacher_projects
            ADD CONSTRAINT teacher_projects_status_check
            CHECK (status IN ('draft', 'published', 'archived'));
        END IF;
      END
      $$;
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'teacher_projects_access_scope_check'
        ) THEN
          ALTER TABLE public.teacher_projects
            ADD CONSTRAINT teacher_projects_access_scope_check
            CHECK (access_scope IN ('all', 'targeted'));
        END IF;
      END
      $$;
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'teacher_projects_locale_check'
        ) THEN
          ALTER TABLE public.teacher_projects
            ADD CONSTRAINT teacher_projects_locale_check
            CHECK (locale IS NULL OR locale IN ('pt-BR', 'es'));
        END IF;
      END
      $$;
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_projects_status_idx
      ON public.teacher_projects(status, published_at DESC)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_projects_created_idx
      ON public.teacher_projects(created_at DESC)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_projects_locale_status_idx
      ON public.teacher_projects(locale, status, published_at DESC)
    `

    await db`
      DROP TABLE IF EXISTS public.teacher_project_sections
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_project_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
        asset_type TEXT NOT NULL,
        locale TEXT NULL,
        title_pt TEXT NULL,
        title_es TEXT NULL,
        description_pt TEXT NULL,
        description_es TEXT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        uploaded_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      ALTER TABLE public.teacher_project_assets
      ADD COLUMN IF NOT EXISTS locale TEXT NULL
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'teacher_project_assets_type_check'
        ) THEN
          ALTER TABLE public.teacher_project_assets
            ADD CONSTRAINT teacher_project_assets_type_check
            CHECK (asset_type IN ('gallery_image', 'document'));
        END IF;
      END
      $$;
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'teacher_project_assets_locale_check'
        ) THEN
          ALTER TABLE public.teacher_project_assets
            ADD CONSTRAINT teacher_project_assets_locale_check
            CHECK (locale IS NULL OR locale IN ('pt-BR', 'es'));
        END IF;
      END
      $$;
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_project_assets_project_type_idx
      ON public.teacher_project_assets(project_id, asset_type, sort_order, created_at)
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_project_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
        title_pt TEXT NOT NULL,
        title_es TEXT NOT NULL,
        url TEXT NOT NULL,
        description_pt TEXT NULL,
        description_es TEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_project_links_project_idx
      ON public.teacher_project_links(project_id, sort_order, created_at)
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_project_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_project_comments_project_idx
      ON public.teacher_project_comments(project_id, created_at DESC)
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_project_teacher_notes (
        project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
        teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
        note TEXT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(project_id, teacher_id)
      )
    `

    await db`
      CREATE TABLE IF NOT EXISTS public.teacher_project_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES public.teacher_projects(id) ON DELETE CASCADE,
        revision_number INT NOT NULL,
        snapshot JSONB NOT NULL,
        created_by UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS teacher_project_revisions_unique_idx
      ON public.teacher_project_revisions(project_id, revision_number)
    `

    await db`
      CREATE INDEX IF NOT EXISTS teacher_project_revisions_project_idx
      ON public.teacher_project_revisions(project_id, created_at DESC)
    `
  })
}

