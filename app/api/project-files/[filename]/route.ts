import path from "node:path"
import { access, constants, readdir, readFile } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { requireTeacherApi } from "@/lib/auth/require"
import { isAdminUser } from "@/lib/auth/authorization"
import { canManageProjects } from "@/lib/auth/project-admin"
import { db } from "@/lib/db"
import {
  canTeacherAccessProject,
  ensureProjectsSchema,
  isProjectCategoryAccessReady,
  loadTeacherScopeData,
} from "@/lib/projects"
import { canTeacherAccessProjectWithCategory } from "@/lib/project-category-access"

export const runtime = "nodejs"

type CachedResolvedFile = {
  absPath: string
  expiresAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __bw9ProjectFilesCache: Map<string, CachedResolvedFile> | undefined
}

const CACHE_TTL_MS = 60_000

function getCache() {
  if (!globalThis.__bw9ProjectFilesCache) {
    globalThis.__bw9ProjectFilesCache = new Map<string, CachedResolvedFile>()
  }
  return globalThis.__bw9ProjectFilesCache
}

function safeFilename(name: string) {
  const value = String(name ?? "").trim()
  if (!value) return null
  if (value.includes("/") || value.includes("\\") || value.includes("..")) return null
  return value
}

function mimeFromExt(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  if (ext === "avif") return "image/avif"
  if (ext === "svg") return "image/svg+xml"
  if (ext === "pdf") return "application/pdf"
  if (ext === "doc") return "application/msword"
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (ext === "ppt") return "application/vnd.ms-powerpoint"
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  if (ext === "xls") return "application/vnd.ms-excel"
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  if (ext === "csv") return "text/csv"
  return "application/octet-stream"
}

async function fileExists(absPath: string) {
  try {
    await access(absPath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

async function findFileInTree(root: string, filename: string, maxDepth: number): Promise<string | null> {
  if (maxDepth < 0) return null

  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    if (entry.isFile() && entry.name === filename) {
      return path.join(root, entry.name)
    }
  }

  if (maxDepth === 0) return null

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const resolved = await findFileInTree(path.join(root, entry.name), filename, maxDepth - 1)
    if (resolved) return resolved
  }

  return null
}

async function resolveFileByFilename(filename: string) {
  const cache = getCache()
  const now = Date.now()
  const cached = cache.get(filename)
  if (cached && cached.expiresAt > now) {
    return cached.absPath
  }

  const uploadsRoot = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "uploads",
  )
  const directCandidates = [
    path.join(uploadsRoot, "projects", filename),
  ]

  for (const candidate of directCandidates) {
    if (await fileExists(candidate)) {
      cache.set(filename, { absPath: candidate, expiresAt: now + CACHE_TTL_MS })
      return candidate
    }
  }

  const projectsRoot = path.join(uploadsRoot, "projects")
  const projectFile = await findFileInTree(projectsRoot, filename, 4)
  if (projectFile) {
    cache.set(filename, { absPath: projectFile, expiresAt: now + CACHE_TTL_MS })
    return projectFile
  }

  return null
}

async function canReadProjectFile(filename: string, auth: Awaited<ReturnType<typeof requireTeacherApi>>) {
  if (!auth.ok) return false
  if (isAdminUser(auth.teacher) && canManageProjects(auth.teacherId)) return true

  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()

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

  let projects: any[] = []
  try {
    projects = await db`
      SELECT DISTINCT
        p.id,
        p.locale,
        p.access_scope,
        p.target_teacher_ids,
        p.target_countries,
        p.target_student_years,
        p.target_class_ids,
        ${categoryAccessSelect}
      FROM public.teacher_projects p
      LEFT JOIN public.teacher_project_categories category
        ON category.id = p.category_id
        AND category.status = 'active'
        AND category.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
        AND p.status = 'published'
        AND (
          REGEXP_REPLACE(COALESCE(p.cover_image_url, ''), '^.*/', '') = ${filename}
          OR REGEXP_REPLACE(COALESCE(category.cover_image_url, ''), '^.*/', '') = ${filename}
          OR EXISTS (
            SELECT 1
            FROM public.teacher_project_assets asset
            WHERE asset.project_id = p.id
              AND REGEXP_REPLACE(COALESCE(asset.file_url, ''), '^.*/', '') = ${filename}
          )
        )
    `
  } catch (error) {
    if (categoryAccessReady) throw error
    projects = await db`
      SELECT DISTINCT
        p.id,
        p.locale,
        p.access_scope,
        p.target_teacher_ids,
        p.target_countries,
        p.target_student_years,
        p.target_class_ids,
        'all'::text AS category_access_scope,
        ARRAY[]::uuid[] AS category_target_teacher_ids,
        ARRAY[]::text[] AS category_target_countries,
        ARRAY[]::text[] AS category_target_locales
      FROM public.teacher_projects p
      WHERE p.deleted_at IS NULL
        AND p.status = 'published'
        AND (
          REGEXP_REPLACE(COALESCE(p.cover_image_url, ''), '^.*/', '') = ${filename}
          OR EXISTS (
            SELECT 1
            FROM public.teacher_project_assets asset
            WHERE asset.project_id = p.id
              AND REGEXP_REPLACE(COALESCE(asset.file_url, ''), '^.*/', '') = ${filename}
          )
        )
    `
  }

  if (projects.length === 0) return false

  const scope = await loadTeacherScopeData(auth.teacherId)

  return projects.some((project) =>
    canTeacherAccessProjectWithCategory(
      project as any,
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
    ),
  )
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ filename: string }> }) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const { filename } = await ctx.params
  const safe = safeFilename(filename)
  if (!safe) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 })

  if (!(await canReadProjectFile(safe, auth))) {
    return NextResponse.json({ error: "Sem permissão para acessar este arquivo." }, { status: 403 })
  }

  const resolved = await resolveFileByFilename(safe)
  if (!resolved) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 })

  try {
    const file = await readFile(resolved)
    return new NextResponse(file, {
      headers: {
        "Content-Type": mimeFromExt(safe),
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch {
    return NextResponse.json({ error: "Falha ao ler arquivo." }, { status: 500 })
  }
}
