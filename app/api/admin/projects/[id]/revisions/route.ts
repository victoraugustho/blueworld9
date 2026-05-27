import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import { ensureProjectsSchema, isUuid } from "@/lib/projects"

type Ctx = { params: Promise<{ id: string }> }

function parsePagination(params: URLSearchParams) {
  const pageRaw = Number(params.get("page") ?? 1)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const pageSizeRaw = Number(params.get("page_size") ?? 20)
  const page_size = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(100, Math.floor(pageSizeRaw)) : 20
  const offset = (page - 1) * page_size
  return { page, page_size, offset }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const { page, page_size, offset } = parsePagination(req.nextUrl.searchParams)

  const [countRow] = await db`
    SELECT COUNT(*)::int AS count
    FROM public.teacher_project_revisions
    WHERE project_id = ${id}
  `

  const items = await db`
    SELECT
      r.id,
      r.project_id,
      r.revision_number,
      r.created_at,
      r.created_by,
      t.name AS created_by_name,
      t.email AS created_by_email
    FROM public.teacher_project_revisions r
    LEFT JOIN public.teachers t ON t.id = r.created_by
    WHERE r.project_id = ${id}
    ORDER BY r.revision_number DESC
    LIMIT ${page_size}
    OFFSET ${offset}
  `

  return NextResponse.json({
    items,
    page,
    page_size,
    total: Number(countRow?.count ?? 0),
  })
}

