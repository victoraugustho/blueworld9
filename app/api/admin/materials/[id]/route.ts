import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

type MaterialLanguage = "pt-BR" | "es"

// GET — carregar material por ID
export async function GET(req: NextRequest, context: any) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const [material] = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE m.id = ${id}
    LIMIT 1
  `

  if (!material) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  }

  return NextResponse.json(material)
}

// PUT — atualizar material
export async function PUT(req: NextRequest, context: any) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const body = await req.json()

  const title = body.title?.trim()
  const description = body.description?.trim() ?? ""
  const file_url = body.file_url?.trim()
  const file_type = body.file_type
  const category_id_raw = body.category_id
  const student_year_raw = body.student_year
  const language: MaterialLanguage = body.language ?? "pt-BR"

  const category_id =
    category_id_raw === "" || category_id_raw === null || category_id_raw === undefined
      ? null
      : Number(category_id_raw)

  const student_year =
    student_year_raw === "" || student_year_raw === null || student_year_raw === undefined
      ? null
      : Number(student_year_raw)

  if (!title || !file_url || !file_type) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!["video", "document"].includes(file_type)) {
    return NextResponse.json({ error: "Tipo de arquivo inválido" }, { status: 400 })
  }

  if (student_year !== null) {
    const isNumber = Number.isInteger(student_year)
    const isGrade = student_year >= 1 && student_year <= 9
    const isAge = student_year >= 103 && student_year <= 105
    const isHigh = student_year >= 201 && student_year <= 203
    if (!isNumber || (!isGrade && !isAge && !isHigh)) {
      return NextResponse.json({ error: "Ano do aluno invalido" }, { status: 400 })
    }
  }

  if (!["pt-BR", "es"].includes(language)) {
    return NextResponse.json({ error: "Idioma inválido" }, { status: 400 })
  }

  const [updated] = await db`
    UPDATE materials
    SET
      title = ${title},
      description = ${description},
      file_url = ${file_url},
      file_type = ${file_type},
      category_id = ${category_id},
      language = ${language},
      student_year = ${student_year}
    WHERE id = ${id}
    RETURNING *
  `

  if (!updated) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.materials.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "material", id },
    metadata: { title, file_type, category_id, language, student_year },
  })

  return NextResponse.json(updated)
}

// DELETE — remover material
export async function DELETE(req: NextRequest, context: any) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  await db`
    DELETE FROM materials
    WHERE id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.materials.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "material", id },
  })

  return NextResponse.json({ success: true })
}
