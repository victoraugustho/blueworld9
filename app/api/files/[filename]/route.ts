import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

function safeFilename(name: string) {
  if (!name) return null
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return null
  return name
}

function contentTypeFromExt(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  return "application/octet-stream"
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params
  const safe = safeFilename(filename)
  if (!safe) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 })

  // ✅ protege: só logado acessa
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  // ✅ garante que o arquivo é o avatar do teacher logado
  const avatarUrl = `/api/files/avatar/${safe}`
  const [t] = await db`
    SELECT id
    FROM teachers
    WHERE id = ${teacherId}
      AND avatar_url = ${avatarUrl}
    LIMIT 1
  `
  if (!t) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const absPath = path.join(process.cwd(), "public", "uploads", "avatars", safe)

  try {
    const buf = await readFile(absPath)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentTypeFromExt(safe),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    })
  } catch {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }
}
