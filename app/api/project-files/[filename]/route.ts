import path from "node:path"
import { access, constants, readdir, readFile } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { requireTeacherApi } from "@/lib/auth/require"

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

  const uploadsRoot = path.join(process.cwd(), "public", "uploads")
  const directCandidates = [
    path.join(uploadsRoot, filename),
    path.join(uploadsRoot, "projects", filename),
    path.join(uploadsRoot, "blog", filename),
    path.join(uploadsRoot, "avatars", filename),
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

  const blogRoot = path.join(uploadsRoot, "blog")
  const blogFile = await findFileInTree(blogRoot, filename, 3)
  if (blogFile) {
    cache.set(filename, { absPath: blogFile, expiresAt: now + CACHE_TTL_MS })
    return blogFile
  }

  return null
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ filename: string }> }) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const { filename } = await ctx.params
  const safe = safeFilename(filename)
  if (!safe) return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 })

  const resolved = await resolveFileByFilename(safe)
  if (!resolved) return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 })

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
