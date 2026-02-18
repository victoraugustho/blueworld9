import { NextRequest, NextResponse } from "next/server"
import { requireTeacherApi } from "@/lib/auth/require"
import path from "node:path"
import { readFile } from "node:fs/promises"

export const runtime = "nodejs"

function mimeFromExt(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "pdf") return "application/pdf"
  return "application/octet-stream"
}

// bloqueia path traversal + limita extensões
function safeFilename(name: string) {
  if (!name) return null
  if (
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\") ||
    name.toLowerCase().includes("%2f") ||
    name.toLowerCase().includes("%5c")
  ) {
    return null
  }

  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext) return null

  // Ajuste se quiser permitir mais tipos
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "pdf"])
  if (!allowed.has(ext)) return null

  return name
}

// Heurística simples: avatar segue o padrão: <uuid>-<uuid>.<ext>
// (ex: teacherId-randomUUID.jpg)
function isAvatarFilename(filename: string) {
  // não precisa ser perfeito, só uma regra pra não abrir tudo
  return /^[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(filename)
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params
  const safe = safeFilename(filename)

  if (!safe) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 })
  }

  // ✅ AVATAR: público
  // Se for avatar, serve direto sem auth.
  // (Se você quiser deixar avatar privado, você vai ter dor de cabeça com <img> e cache.)
  const avatarPublic = isAvatarFilename(safe)

  if (!avatarPublic) {
    // ✅ OUTROS ARQUIVOS: protegidos
    const auth = await requireTeacherApi()
    if (!auth.ok) {
      return auth.response
    }
  }

  // todos os arquivos que sua rota serve estão aqui:
  // /public/uploads/avatars/<filename>
  // Se futuramente você quiser servir PDFs em outra pasta, dá pra ramificar aqui.
  const absPath = path.join(process.cwd(), "public", "uploads", "avatars", safe)

  try {
    const buf = await readFile(absPath)

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeFromExt(safe),
        // cache forte para avatar público
        ...(avatarPublic
          ? { "Cache-Control": "public, max-age=31536000, immutable" }
          : { "Cache-Control": "private, no-store" }),
      },
    })
  } catch {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }
}
