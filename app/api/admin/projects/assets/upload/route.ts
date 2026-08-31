import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import { ensureProjectsSchema, getProjectUploadLimits } from "@/lib/projects"
import { normalizeProjectFileUrl } from "@/lib/project-file-url"
import { writeAuditLog } from "@/lib/audit"

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
])

const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv"])
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"])

function normalizeFilename(name: string) {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) return "arquivo"
  return trimmed.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 180)
}

function getExtension(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return ext.replace(/[^a-z0-9]/g, "")
}

function isAllowedByKind(kind: "image" | "document", mimeType: string, extension: string) {
  if (kind === "image") {
    return IMAGE_MIME_TYPES.has(mimeType) || IMAGE_EXTENSIONS.has(extension)
  }
  return DOCUMENT_MIME_TYPES.has(mimeType) || DOCUMENT_EXTENSIONS.has(extension)
}

export async function POST(req: NextRequest) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Payload inválido." }, { status: 400 })

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 })
  }

  const kindRaw = String(form.get("kind") ?? "image").trim().toLowerCase()
  const kind: "image" | "document" = kindRaw === "document" ? "document" : "image"
  const scopeRaw = String(form.get("scope") ?? "project").trim().toLowerCase()
  const isCategoryCover = scopeRaw === "category"

  const originalName = normalizeFilename(file.name || `arquivo-${Date.now()}`)
  const extension = getExtension(originalName)
  const mimeType = String(file.type ?? "").trim().toLowerCase()

  if (!isAllowedByKind(kind, mimeType, extension)) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 })
  }

  const limits = getProjectUploadLimits()
  const maxBytes = kind === "image" ? limits.imageBytes : limits.documentBytes
  if (file.size <= 0 || file.size > maxBytes) {
    const maxMb = kind === "image" ? limits.imageLimitMb : limits.documentLimitMb
    return NextResponse.json({ error: `Arquivo excede o limite de ${maxMb}MB.` }, { status: 400 })
  }

  let storageUrl = ""
  try {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const dirRel = isCategoryCover
      ? path.join("projects", "categories", year, month)
      : path.join("projects", year, month)
    const baseDir = path.join(process.cwd(), "public", "uploads", dirRel)
    await fs.mkdir(baseDir, { recursive: true })

    const safeExt = extension || (kind === "image" ? "png" : "pdf")
    const generatedName = `${randomUUID()}.${safeExt}`
    const finalPath = path.join(baseDir, generatedName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(finalPath, buffer)

    const storageKey = path.join(dirRel, generatedName).replaceAll("\\", "/")
    storageUrl = `/uploads/${storageKey}`
  } catch (error) {
    console.error("[admin.projects.assets.upload] failed to persist file", error)
    return NextResponse.json(
      {
        error:
          "Não foi possível salvar o arquivo no servidor. Verifique a permissão de escrita e o volume de /app/public/uploads.",
      },
      { status: 500 },
    )
  }

  const fileUrl = normalizeProjectFileUrl(storageUrl)

  await writeAuditLog({
    req,
    action: "admin.projects.assets.upload",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    metadata: {
      kind,
      scope: isCategoryCover ? "category" : "project",
      original_name: originalName,
      mime_type: mimeType,
      size_bytes: file.size,
      file_url: fileUrl,
      storage_url: storageUrl,
    },
  })

  return NextResponse.json({
    success: true,
    kind,
    scope: isCategoryCover ? "category" : "project",
    file_name: originalName,
    file_url: fileUrl,
    storage_url: storageUrl,
    mime_type: mimeType || "application/octet-stream",
    size_bytes: file.size,
  })
}
