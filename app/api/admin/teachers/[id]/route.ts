import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureTurmasSchema, normalizeCategoryIds, normalizeStudentYears } from "@/lib/turmas"

type Country = "BR" | "UY" | "PY"
type DocType = "CPF" | "CI_UY" | "CI_PY"
type Ctx = { params: Promise<{ id: string }> }

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "")
}

function docTypeForCountry(country: Country): DocType {
  if (country === "BR") return "CPF"
  if (country === "UY") return "CI_UY"
  return "CI_PY"
}

async function hasDownloadPermissionColumn() {
  const [row] = await db`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'teachers'
        AND column_name = 'can_download'
    ) AS ready
  `

  return row?.ready === true
}

async function getTeacherWithTurmas(id: string) {
  const [teacher] = await db`
    SELECT
      id,
      name,
      email,
      phone,
      country,
      locale,
      document_type,
      document_number,
      approved,
      active,
      COALESCE(
        NULLIF(to_jsonb(teachers)->>'can_download', '')::boolean,
        TRUE
      ) AS can_download,
      created_at,
      updated_at
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `

  if (!teacher) return null

  const categories = await db`
    SELECT c.id, c.name
    FROM teacher_categories tc
    JOIN categories c ON c.id = tc.category_id
    WHERE tc.teacher_id = ${id}
    ORDER BY c.name ASC
  `

  const [yearRow] = await db`
    SELECT
      COALESCE(
        ARRAY_AGG(tys.student_year ORDER BY tys.student_year),
        ARRAY[]::smallint[]
      ) AS student_years
    FROM teacher_student_years tys
    WHERE tys.teacher_id = ${id}
  `

  const student_years = Array.isArray(yearRow?.student_years)
    ? yearRow.student_years.map((item: any) => Number(item))
    : []

  return {
    ...teacher,
    category_ids: categories.map((item: any) => Number(item.id)),
    categories,
    student_years,
  }
}

export async function GET(_req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()

  const teacher = await getTeacherWithTurmas(id)

  if (!teacher) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  return NextResponse.json(teacher)
}

export async function PUT(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()
  const body = await req.json().catch(() => ({}))

  const name = String(body.name ?? "").trim()
  const email = String(body.email ?? "").trim().toLowerCase()
  const phone = onlyDigits(String(body.phone ?? ""))

  const country: Country = body.country
  const document_number = onlyDigits(String(body.document_number ?? ""))
  const category_ids = normalizeCategoryIds(body.category_ids)
  const student_years = normalizeStudentYears(body.student_years)

  const approved = !!body.approved
  const active = body.active !== undefined ? !!body.active : true
  const can_download = body.can_download !== undefined ? !!body.can_download : true

  if (!name || !email || !phone || !country || !document_number) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
  }

  if (!["BR", "UY", "PY"].includes(country)) {
    return NextResponse.json({ error: "Pais invalido" }, { status: 400 })
  }

  if (category_ids.length > 0) {
    const validCategories = await db`
      SELECT id
      FROM categories
      WHERE id = ANY(${category_ids}::int[])
    `

    if (validCategories.length !== category_ids.length) {
      return NextResponse.json({ error: "Existe categoria invalida na selecao" }, { status: 400 })
    }
  }

  const document_type: DocType = docTypeForCountry(country)
  const locale = country === "BR" ? "pt-BR" : "es"

  const downloadPermissionReady = await hasDownloadPermissionColumn()
  const [teacherRow] = downloadPermissionReady
    ? await db`
        UPDATE teachers
        SET
          name = ${name},
          email = ${email},
          phone = ${phone},
          country = ${country},
          locale = ${locale},
          document_type = ${document_type},
          document_number = ${document_number},
          approved = ${approved},
          active = ${active},
          can_download = ${can_download}
        WHERE id = ${id}
        RETURNING
          id,
          name,
          email,
          phone,
          country,
          locale,
          document_type,
          document_number,
          approved,
          active,
          can_download,
          created_at,
          updated_at
      `
    : await db`
        UPDATE teachers
        SET
          name = ${name},
          email = ${email},
          phone = ${phone},
          country = ${country},
          locale = ${locale},
          document_type = ${document_type},
          document_number = ${document_number},
          approved = ${approved},
          active = ${active}
        WHERE id = ${id}
        RETURNING
          id,
          name,
          email,
          phone,
          country,
          locale,
          document_type,
          document_number,
          approved,
          active,
          TRUE AS can_download,
          created_at,
          updated_at
      `

  if (!teacherRow) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  await db`
    DELETE FROM teacher_categories
    WHERE teacher_id = ${id}
  `

  if (category_ids.length > 0) {
    await db`
      INSERT INTO teacher_categories (teacher_id, category_id)
      SELECT ${id}::uuid, UNNEST(${category_ids}::int[])
      ON CONFLICT (teacher_id, category_id) DO NOTHING
    `
  }

  await db`
    DELETE FROM teacher_student_years
    WHERE teacher_id = ${id}
  `

  if (student_years.length > 0) {
    await db`
      INSERT INTO teacher_student_years (teacher_id, student_year)
      SELECT ${id}::uuid, UNNEST(${student_years}::smallint[])
      ON CONFLICT (teacher_id, student_year) DO NOTHING
    `
  }

  const categories = await db`
    SELECT c.id, c.name
    FROM teacher_categories tc
    JOIN categories c ON c.id = tc.category_id
    WHERE tc.teacher_id = ${id}
    ORDER BY c.name ASC
  `

  const updated = {
    ...teacherRow,
    category_ids: categories.map((item: any) => Number(item.id)),
    categories,
    student_years,
  }

  await writeAuditLog({
    req,
    action: "admin.teachers.update",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "teacher", id },
    metadata: {
      name,
      email,
      country,
      approved,
      active,
      can_download,
      category_count: category_ids.length,
      turma_year_count: student_years.length,
    },
  })

  return NextResponse.json(updated)
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()

  const [result] = await db`
    UPDATE teachers
    SET approved = TRUE
    WHERE id = ${id}
    RETURNING
      id,
      name,
      email,
      phone,
      country,
      locale,
      document_type,
      document_number,
      approved,
      active,
      created_at,
      updated_at
  `

  if (!result) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.teachers.approve",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "teacher", id },
  })

  const teacher = await getTeacherWithTurmas(id)
  return NextResponse.json(teacher ?? result)
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const resolved = await context.params
  const id = String(resolved?.id ?? "").trim()

  await db`
    DELETE FROM teachers
    WHERE id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.teachers.delete",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "teacher", id },
  })

  return NextResponse.json({ success: true })
}
