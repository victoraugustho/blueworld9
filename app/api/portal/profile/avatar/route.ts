import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"

// IMPORTANTE: precisa rodar em Node runtime (não Edge) por causa de fs
export const runtime = "nodejs"

const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"])

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return null
}

// valida assinatura simples (magic bytes) pra evitar “jpg fake”
function looksLikeImage(buf: Buffer, mime: string) {
  // JPEG: FF D8 FF
  if (mime === "image/jpeg") return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === "image/png") {
    return (
      buf.length > 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    )
  }
  // WEBP: "RIFF" .... "WEBP"
  if (mime === "image/webp") {
    return (
      buf.length > 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    )
  }
  return false
}

function safeUnlinkPublicUrl(url: string) {
  // url esperada: /uploads/avatars/<file>
  if (!url?.startsWith("/uploads/avatars/")) return null
  const filename = url.replace("/uploads/avatars/", "")
  // bloqueia path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null
  return filename
}

export async function POST(req: NextRequest) {
  try {
    const teacherId = (await cookies()).get("teacher_id")?.value
    if (!teacherId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const [teacher] = await db`
      SELECT id, active, approved, avatar_url
      FROM teachers
      WHERE id = ${teacherId}
      LIMIT 1
    `
    if (!teacher || teacher.active === false || teacher.approved === false) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const form = await req.formData()
    const file = form.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 })
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (máx 2MB)" }, { status: 400 })
    }

    const ext = extFromMime(file.type)
    if (!ext) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)

    if (!looksLikeImage(buf, file.type)) {
      return NextResponse.json({ error: "Arquivo inválido (assinatura)" }, { status: 400 })
    }

    // diretório público para servir estático
    const relDir = "/uploads/avatars"
    const absDir = path.join(process.cwd(), "public", "uploads", "avatars")
    await mkdir(absDir, { recursive: true })

    const filename = `${teacherId}-${crypto.randomUUID()}.${ext}`
    const absPath = path.join(absDir, filename)

    await writeFile(absPath, buf)

    const publicUrl = `${relDir}/${filename}`

    // se tinha avatar anterior do próprio sistema, remove
    const old = safeUnlinkPublicUrl(String(teacher.avatar_url ?? ""))
    if (old) {
      const oldAbs = path.join(absDir, old)
      // best effort
      unlink(oldAbs).catch(() => {})
    }

    await db`
      UPDATE teachers
      SET avatar_url = ${publicUrl},
          updated_at = NOW()
      WHERE id = ${teacherId}
    `

    return NextResponse.json({ ok: true, avatar_url: publicUrl })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao enviar avatar" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const teacherId = (await cookies()).get("teacher_id")?.value
    if (!teacherId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const [teacher] = await db`
      SELECT id, active, approved, avatar_url
      FROM teachers
      WHERE id = ${teacherId}
      LIMIT 1
    `
    if (!teacher || teacher.active === false || teacher.approved === false) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const absDir = path.join(process.cwd(), "public", "uploads", "avatars")
    const old = safeUnlinkPublicUrl(String(teacher.avatar_url ?? ""))
    if (old) {
      unlink(path.join(absDir, old)).catch(() => {})
    }

    await db`
      UPDATE teachers
      SET avatar_url = NULL,
          updated_at = NOW()
      WHERE id = ${teacherId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao remover avatar" }, { status: 500 })
  }
}
