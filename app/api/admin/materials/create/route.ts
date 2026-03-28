import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema, normalizeTeacherIds } from "@/lib/turmas"

type MaterialLanguage = "pt-BR" | "es"
type AccessScope = "all" | "specific"

function parseOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null
  return Number(value)
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const body = await request.json().catch(() => ({}))

  const title = String(body.title ?? "").trim()
  const description = String(body.description ?? "").trim()
  const rawVideoNotes = String(body.video_notes ?? "").trim()
  const file_url = String(body.file_url ?? "").trim()
  const file_type = body.file_type
  const category_id = parseOptionalNumber(body.category_id)
  const student_year = parseOptionalNumber(body.student_year)
  const language: MaterialLanguage = body.language === "es" ? "es" : "pt-BR"

  const teacherIdsRaw = Array.isArray(body.teacher_ids)
    ? body.teacher_ids
    : body.teacher_id
      ? [body.teacher_id]
      : []
  const teacher_ids = normalizeTeacherIds(teacherIdsRaw)
  const access_scope: AccessScope =
    body.access_scope === "specific" || teacher_ids.length > 0 ? "specific" : "all"

  if (!title || !file_url || !file_type) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!["video", "document"].includes(file_type)) {
    return NextResponse.json({ error: "Tipo de arquivo invalido" }, { status: 400 })
  }

  if (rawVideoNotes.length > 4000) {
    return NextResponse.json({ error: "Observacoes do video muito longas (max 4000 caracteres)" }, { status: 400 })
  }

  const video_notes = file_type === "video" ? rawVideoNotes || null : null

  if (category_id !== null && (!Number.isInteger(category_id) || category_id <= 0)) {
    return NextResponse.json({ error: "Categoria invalida" }, { status: 400 })
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
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 })
  }

  if (category_id !== null) {
    const [category] = await db`
      SELECT id
      FROM categories
      WHERE id = ${category_id}
      LIMIT 1
    `
    if (!category) {
      return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 400 })
    }
  }

  if (!["all", "specific"].includes(access_scope)) {
    return NextResponse.json({ error: "Escopo de acesso invalido" }, { status: 400 })
  }

  if (access_scope === "specific" && teacher_ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um professor" }, { status: 400 })
  }

  if (teacher_ids.length > 0) {
    const validTeachers = await db`
      SELECT id
      FROM teachers
      WHERE id = ANY(${teacher_ids}::uuid[])
    `
    if (validTeachers.length !== teacher_ids.length) {
      return NextResponse.json({ error: "Existe professor invalido na selecao" }, { status: 400 })
    }
  }

  const [created] = await db`
    INSERT INTO materials (
      title,
      description,
      video_notes,
      file_url,
      file_type,
      category_id,
      language,
      student_year,
      access_scope
    )
    VALUES (
      ${title},
      ${description},
      ${video_notes},
      ${file_url},
      ${file_type},
      ${category_id},
      ${language},
      ${student_year},
      ${access_scope}
    )
    RETURNING id
  `

  if (created?.id && access_scope === "specific" && teacher_ids.length > 0) {
    await db`
      INSERT INTO material_teacher_access (material_id, teacher_id)
      SELECT ${created.id}::uuid, UNNEST(${teacher_ids}::uuid[])
      ON CONFLICT (material_id, teacher_id) DO NOTHING
    `
  }

  await writeAuditLog({
    req: request,
    action: "admin.materials.create",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "material", id: created?.id },
    metadata: {
      title,
      file_type,
      has_video_notes: Boolean(video_notes),
      category_id,
      language,
      student_year,
      access_scope,
      teacher_count: teacher_ids.length,
    },
  })

  return NextResponse.json({ success: true, material_id: created?.id })
}
