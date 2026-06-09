import { NextResponse } from "next/server"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import { ensureProjectsSchema, getProjectUploadLimits } from "@/lib/projects"
import { db } from "@/lib/db"
import { TURMA_YEAR_OPTIONS } from "@/lib/turma-years"

export async function GET() {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const teachers = await db`
    SELECT id, name, email, country
    FROM public.teachers
    WHERE active = TRUE
      AND approved = TRUE
    ORDER BY name ASC
  `

  let categories: any[] = []
  try {
    categories = await db`
      SELECT id, locale, title, description, cover_image_url, sort_order
      FROM public.teacher_project_categories
      WHERE status = 'active'
        AND deleted_at IS NULL
      ORDER BY locale ASC, sort_order ASC, title ASC
    `
  } catch (error) {
    console.error("[admin.projects.options] categories query failed", error)
  }

  const limits = getProjectUploadLimits()

  return NextResponse.json({
    teachers,
    categories,
    student_year_options: TURMA_YEAR_OPTIONS,
    countries: ["BR", "UY", "PY"],
    upload_limits: {
      image_limit_mb: limits.imageLimitMb,
      document_limit_mb: limits.documentLimitMb,
    },
  })
}
