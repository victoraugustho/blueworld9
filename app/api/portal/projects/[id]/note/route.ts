import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import {
  canTeacherAccessProject,
  ensureProjectsSchema,
  isUuid,
  loadTeacherScopeData,
} from "@/lib/projects"

type Ctx = { params: Promise<{ id: string }> }

async function ensureProjectVisibility(projectId: string, teacherId: string, teacherCountry: string | null) {
  const [project] = await db`
    SELECT *
    FROM public.teacher_projects
    WHERE id = ${projectId}
      AND deleted_at IS NULL
      AND status = 'published'
    LIMIT 1
  `
  if (!project) return { ok: false as const, code: 404 as const }

  const scope = await loadTeacherScopeData(teacherId)
  const canAccess = canTeacherAccessProject(project as any, {
    teacherId,
    teacherCountry,
    teacherYears: scope.years,
    teacherClassIds: scope.classIds,
  })
  if (!canAccess) return { ok: false as const, code: 403 as const }
  return { ok: true as const }
}

export async function GET(_: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const visibility = await ensureProjectVisibility(
    id,
    auth.teacherId,
    auth.teacher.country ? String(auth.teacher.country) : null,
  )
  if (!visibility.ok) {
    return NextResponse.json(
      { error: visibility.code === 404 ? "Projeto não encontrado." : "Sem permissão." },
      { status: visibility.code },
    )
  }

  const [note] = await db`
    SELECT note, updated_at
    FROM public.teacher_project_teacher_notes
    WHERE project_id = ${id}
      AND teacher_id = ${auth.teacherId}
    LIMIT 1
  `

  return NextResponse.json({
    note: note?.note ?? "",
    updated_at: note?.updated_at ?? null,
  })
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const visibility = await ensureProjectVisibility(
    id,
    auth.teacherId,
    auth.teacher.country ? String(auth.teacher.country) : null,
  )
  if (!visibility.ok) {
    return NextResponse.json(
      { error: visibility.code === 404 ? "Projeto não encontrado." : "Sem permissão." },
      { status: visibility.code },
    )
  }

  const body = await req.json().catch(() => ({}))
  const note = String(body.note ?? "").trim()
  if (note.length > 12000) {
    return NextResponse.json({ error: "Observação muito grande (máximo 12000 caracteres)." }, { status: 400 })
  }

  const [saved] = await db`
    INSERT INTO public.teacher_project_teacher_notes (
      project_id,
      teacher_id,
      note
    )
    VALUES (
      ${id},
      ${auth.teacherId},
      ${note}
    )
    ON CONFLICT (project_id, teacher_id)
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = NOW()
    RETURNING note, updated_at
  `

  return NextResponse.json(saved)
}
