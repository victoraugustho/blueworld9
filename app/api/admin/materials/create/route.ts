import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type MaterialLanguage = "pt-BR" | "es"

export async function POST(request: NextRequest) {
  const body = await request.json()

  const title = body.title?.trim()
  const description = body.description?.trim() ?? ""
  const file_url = body.file_url?.trim()
  const file_type = body.file_type
  const category_id_raw = body.category_id
  const language: MaterialLanguage = body.language ?? "pt-BR"

  const category_id =
    category_id_raw === "" || category_id_raw === null || category_id_raw === undefined
      ? null
      : Number(category_id_raw)

  if (!title || !file_url || !file_type) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!["video", "document"].includes(file_type)) {
    return NextResponse.json({ error: "Tipo de arquivo inválido" }, { status: 400 })
  }

  if (!["pt-BR", "es"].includes(language)) {
    return NextResponse.json({ error: "Idioma inválido" }, { status: 400 })
  }

  await db`
    INSERT INTO materials (title, description, file_url, file_type, category_id, language)
    VALUES (${title}, ${description}, ${file_url}, ${file_type}, ${category_id}, ${language})
  `

  return NextResponse.json({ success: true })
}
