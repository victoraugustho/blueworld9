import { NextResponse } from "next/server"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import { ensureProjectsSchema, getProjectUploadLimits, isProjectCategoryAccessReady } from "@/lib/projects"
import { db } from "@/lib/db"
import { TURMA_YEAR_OPTIONS } from "@/lib/turma-years"

export async function GET() {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()
  const categoryAccessReady = await isProjectCategoryAccessReady()

  const teachers = await db`
    SELECT
      t.id, t.name, t.email, t.country, t.locale,
      COALESCE((
        SELECT ARRAY_AGG(DISTINCT tc.student_year ORDER BY tc.student_year)
        FROM public.teacher_classes tc
        WHERE tc.teacher_id = t.id
          AND tc.active = TRUE
          AND tc.student_year IS NOT NULL
      ), ARRAY[]::smallint[]) AS student_years
    FROM public.teachers t
    WHERE t.active = TRUE
      AND t.approved = TRUE
    ORDER BY name ASC
  `

  let categories: any[] = []
  try {
    const categoryAccessSelect = categoryAccessReady
      ? db`access_scope, target_teacher_ids, target_countries, target_locales,`
      : db`
          'all'::text AS access_scope,
          ARRAY[]::uuid[] AS target_teacher_ids,
          ARRAY[]::text[] AS target_countries,
          ARRAY[]::text[] AS target_locales,
        `
    categories = await db`
      SELECT
        id,
        locale,
        title,
        description,
        cover_image_url,
        sort_order,
        ${categoryAccessSelect}
        status
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
