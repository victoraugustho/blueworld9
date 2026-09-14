import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const categories = await db`
    SELECT id::text AS id, name AS title
    FROM public.categories
    ORDER BY name ASC
  `

  const materialItems = await db`
    SELECT
      m.id::text AS id,
      m.title,
      m.file_type,
      m.category_id::text AS category_id,
      c.name AS category_title,
      m.language::text AS locale,
      m.student_year
    FROM public.materials m
    LEFT JOIN public.categories c ON c.id = m.category_id
    ORDER BY c.name ASC NULLS LAST, m.title ASC
  `

  const [{ exists: hasProjects } = { exists: false }] = await db`
    SELECT
      to_regclass('public.teacher_projects') IS NOT NULL
      AND to_regclass('public.teacher_project_categories') IS NOT NULL AS exists
  `

  let projectCategories: any[] = []
  let projects: any[] = []
  if (hasProjects) {
    projectCategories = await db`
      SELECT id::text AS id, title, locale
      FROM public.teacher_project_categories
      WHERE status = 'active'
        AND deleted_at IS NULL
      ORDER BY title ASC
    `

    projects = await db`
      SELECT
        p.id::text AS id,
        COALESCE(NULLIF(p.title_pt, ''), NULLIF(p.title_es, ''), 'Projeto sem título') AS title,
        p.category_id::text AS category_id,
        c.title AS category_title,
        p.locale
      FROM public.teacher_projects p
      LEFT JOIN public.teacher_project_categories c ON c.id = p.category_id
      WHERE p.status = 'published'
        AND p.deleted_at IS NULL
      ORDER BY c.title ASC NULLS LAST, title ASC
    `
  }

  return NextResponse.json({
    categories,
    aulas: materialItems.filter((item: any) => item.file_type === "video"),
    materiais: materialItems.filter((item: any) => item.file_type === "document"),
    project_categories: projectCategories,
    projetos: projects,
  })
}

