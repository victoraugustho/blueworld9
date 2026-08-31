import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema, normalizeTeacherIds } from "@/lib/turmas"
import {
  isMaterialAccessPolicyReady,
  normalizeMaterialAccessPolicy,
} from "@/lib/material-access"

type MaterialLanguage = "pt-BR" | "es"
type AccessScope = "all" | "specific"
type Ctx = { params: Promise<{ id: string }> }

function parseOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null
  return Number(value)
}

function normalizeAccessScope(value: unknown, teacherIdsLength: number): AccessScope {
  if (value === "specific" || teacherIdsLength > 0) return "specific"
  return "all"
}

async function loadMaterialById(id: string) {
  const [material] = await db`
    SELECT
      m.*,
      c.name AS category_name,
      COALESCE(m.access_scope, 'all') AS access_scope,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT mta.teacher_id), NULL),
        ARRAY[]::uuid[]
      ) AS teacher_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.name), NULL),
        ARRAY[]::text[]
      ) AS teacher_names
    FROM materials m
    LEFT JOIN categories c ON c.id = m.category_id
    LEFT JOIN material_teacher_access mta ON mta.material_id = m.id
    LEFT JOIN teachers t ON t.id = mta.teacher_id
    WHERE m.id = ${id}
    GROUP BY m.id, c.name
    LIMIT 1
  `

  return material
}

export async function GET(_req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()

  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const material = await loadMaterialById(id)

  if (!material) {
    return NextResponse.json({ error: "Material nao encontrado" }, { status: 404 })
  }

  return NextResponse.json(material)
}

export async function PUT(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()

  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const currentMaterial = await loadMaterialById(id)
  if (!currentMaterial) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  }

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
  const policyReady = await isMaterialAccessPolicyReady()
  const policyWasProvided = Object.prototype.hasOwnProperty.call(body, "access_policy")
  let accessPolicy
  try {
    accessPolicy = normalizeMaterialAccessPolicy(
      policyWasProvided ? body.access_policy : currentMaterial.access_policy,
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Política de acesso inválida" },
      { status: 400 },
    )
  }

  if (accessPolicy && !policyReady) {
    return NextResponse.json(
      { error: "A migração 043_material_access_policy_v2.sql precisa ser executada antes de usar grupos dinâmicos." },
      { status: 503 },
    )
  }

  const effectiveTeacherIds = accessPolicy
    ? accessPolicy.include_teacher_ids
    : teacher_ids
  const referencedTeacherIds = accessPolicy
    ? normalizeTeacherIds([...accessPolicy.include_teacher_ids, ...accessPolicy.exclude_teacher_ids])
    : teacher_ids
  const access_scope = accessPolicy
    ? accessPolicy.mode === "specific" ? "specific" : "all"
    : normalizeAccessScope(body.access_scope, teacher_ids.length)

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

  if (!accessPolicy && access_scope === "specific" && teacher_ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um professor" }, { status: 400 })
  }

  if (referencedTeacherIds.length > 0) {
    const validTeachers = await db`
      SELECT id
      FROM teachers
      WHERE id = ANY(${referencedTeacherIds}::uuid[])
    `
    if (validTeachers.length !== referencedTeacherIds.length) {
      return NextResponse.json({ error: "Existe professor invalido na selecao" }, { status: 400 })
    }
  }

  await db.begin(async (tx) => {
    const sql = (tx as any).sql ?? tx
    if (policyReady) {
      await sql`
        UPDATE materials
        SET
          title = ${title}, description = ${description}, video_notes = ${video_notes},
          file_url = ${file_url}, file_type = ${file_type}, category_id = ${category_id},
          language = ${language}, student_year = ${student_year}, access_scope = ${access_scope},
          access_policy = ${accessPolicy ? db.json(accessPolicy) : null}
        WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE materials
        SET
          title = ${title}, description = ${description}, video_notes = ${video_notes},
          file_url = ${file_url}, file_type = ${file_type}, category_id = ${category_id},
          language = ${language}, student_year = ${student_year}, access_scope = ${access_scope}
        WHERE id = ${id}
      `
    }

    await sql`
      DELETE FROM material_teacher_access
      WHERE material_id = ${id}
    `

    if (effectiveTeacherIds.length > 0) {
      await sql`
        INSERT INTO material_teacher_access (material_id, teacher_id)
        SELECT ${id}::uuid, UNNEST(${effectiveTeacherIds}::uuid[])
        ON CONFLICT (material_id, teacher_id) DO NOTHING
      `
    }
  })

  await writeAuditLog({
    req,
    action: "admin.materials.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "material", id },
    metadata: {
      title,
      file_type,
      has_video_notes: Boolean(video_notes),
      category_id,
      language,
      student_year,
      access_scope,
      access_policy_version: accessPolicy?.version ?? null,
      access_mode: accessPolicy?.mode ?? "legacy",
      teacher_count: effectiveTeacherIds.length,
    },
  })

  const material = await loadMaterialById(id)
  return NextResponse.json(material)
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()

  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
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
