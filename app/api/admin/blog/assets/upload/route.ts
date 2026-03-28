import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import { ensureBlogSchema } from "@/lib/blog"

export const runtime = "nodejs"

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export async function POST(req: NextRequest) {
  const admin = await requireRestrictedAdminApi()
  if (!admin.ok) return admin.response

  await ensureBlogSchema()

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  const alt_default = String(form?.get("alt_default") ?? "").trim() || null
  const caption_default = String(form?.get("caption_default") ?? "").trim() || null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo nao permitido" }, { status: 400 })
  }

  const size_bytes = Number(file.size ?? 0)
  if (!Number.isFinite(size_bytes) || size_bytes <= 0) {
    return NextResponse.json({ error: "Arquivo invalido" }, { status: 400 })
  }

  if (size_bytes > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo excede 10MB" }, { status: 400 })
  }

  const ext = EXT_BY_MIME[file.type] ?? "bin"
  const now = new Date()
  const dirRel = `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}`
  const filename = `${randomUUID()}.${ext}`
  const storage_key = `${dirRel}/${filename}`

  const baseDir = path.join(process.cwd(), "public", "uploads", "blog", dirRel)
  const fullPath = path.join(baseDir, filename)

  await mkdir(baseDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(fullPath, Buffer.from(bytes))

  const public_url = `/uploads/blog/${storage_key.replaceAll("\\", "/")}`

  const [asset] = await db`
    INSERT INTO blog_assets (
      storage_key,
      public_url,
      mime_type,
      size_bytes,
      width,
      height,
      alt_default,
      caption_default,
      created_by
    )
    VALUES (
      ${storage_key},
      ${public_url},
      ${file.type},
      ${size_bytes},
      ${null},
      ${null},
      ${alt_default},
      ${caption_default},
      ${admin.teacherId}
    )
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "admin.blog.assets.upload",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "blog_asset", id: asset?.id },
    metadata: {
      mime_type: file.type,
      size_bytes,
      storage_key,
    },
  })

  return NextResponse.json(asset)
}

