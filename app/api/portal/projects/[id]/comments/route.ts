import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { canManageProjects } from "@/lib/auth/project-admin"
import {
  ensureProjectsSchema,
  isUuid,
} from "@/lib/projects"
import { ensurePublishedProjectAccess } from "@/lib/project-access-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const visibility = await ensurePublishedProjectAccess(id, {
    id: auth.teacherId,
    country: auth.teacher.country ? String(auth.teacher.country) : null,
    locale: auth.teacher.locale,
  })
  if (!visibility.ok) {
    return NextResponse.json(
      { error: visibility.code === 404 ? "Projeto não encontrado." : "Sem permissão." },
      { status: visibility.code },
    )
  }

  const comments = await db`
    SELECT
      c.id,
      c.comment,
      c.created_at,
      c.updated_at,
      c.teacher_id,
      t.name AS teacher_name,
      t.email AS teacher_email,
      t.avatar_url AS teacher_avatar_url
    FROM public.teacher_project_comments c
    JOIN public.teachers t ON t.id = c.teacher_id
    WHERE c.project_id = ${id}
    ORDER BY c.created_at DESC
  `

  const isProjectManager = canManageProjects(auth.teacherId)
  return NextResponse.json(
    comments.map((item: any) => ({
      ...item,
      can_delete: isProjectManager || String(item.teacher_id ?? "") === auth.teacherId,
    })),
  )
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const visibility = await ensurePublishedProjectAccess(id, {
    id: auth.teacherId,
    country: auth.teacher.country ? String(auth.teacher.country) : null,
    locale: auth.teacher.locale,
  })
  if (!visibility.ok) {
    return NextResponse.json(
      { error: visibility.code === 404 ? "Projeto não encontrado." : "Sem permissão." },
      { status: visibility.code },
    )
  }

  const body = await req.json().catch(() => ({}))
  const comment = String(body.comment ?? "").trim()
  if (!comment) return NextResponse.json({ error: "Comentário obrigatório." }, { status: 400 })
  if (comment.length > 6000) {
    return NextResponse.json({ error: "Comentário muito grande (máximo 6000 caracteres)." }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO public.teacher_project_comments (
      project_id,
      teacher_id,
      comment
    )
    VALUES (
      ${id},
      ${auth.teacherId},
      ${comment}
    )
    RETURNING id, comment, created_at, updated_at, teacher_id
  `

  const [teacher] = await db`
    SELECT name, email, avatar_url
    FROM public.teachers
    WHERE id = ${auth.teacherId}
    LIMIT 1
  `

  return NextResponse.json({
    ...created,
    teacher_name: teacher?.name ?? null,
    teacher_email: teacher?.email ?? null,
    teacher_avatar_url: teacher?.avatar_url ?? null,
    can_delete: true,
  })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const visibility = await ensurePublishedProjectAccess(id, {
    id: auth.teacherId,
    country: auth.teacher.country ? String(auth.teacher.country) : null,
    locale: auth.teacher.locale,
  })
  if (!visibility.ok) {
    return NextResponse.json(
      { error: visibility.code === 404 ? "Projeto não encontrado." : "Sem permissão." },
      { status: visibility.code },
    )
  }

  const body = await req.json().catch(() => ({}))
  const fromBody = String(body?.comment_id ?? "").trim()
  const fromQuery = String(req.nextUrl.searchParams.get("comment_id") ?? "").trim()
  const commentId = fromBody || fromQuery
  if (!isUuid(commentId)) {
    return NextResponse.json({ error: "Comentário inválido." }, { status: 400 })
  }

  const [commentRow] = await db`
    SELECT id, teacher_id
    FROM public.teacher_project_comments
    WHERE id = ${commentId}
      AND project_id = ${id}
    LIMIT 1
  `
  if (!commentRow) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 })
  }

  const isProjectManager = canManageProjects(auth.teacherId)
  const isOwner = String(commentRow.teacher_id ?? "") === auth.teacherId
  if (!isProjectManager && !isOwner) {
    return NextResponse.json({ error: "Sem permissão para excluir este comentário." }, { status: 403 })
  }

  await db`
    DELETE FROM public.teacher_project_comments
    WHERE id = ${commentId}
      AND project_id = ${id}
  `

  return NextResponse.json({ success: true, id: commentId })
}
