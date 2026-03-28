import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureTurmasSchema } from "@/lib/turmas"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const [teacher] = await db`
    SELECT id, locale
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `

  if (!teacher) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  const logs = await db`
    SELECT id, action, status, request_path, created_at
    FROM audit_logs
    WHERE actor_id = ${id}
    ORDER BY created_at DESC
    LIMIT 20
  `

  const [summary] = await db`
    WITH teacher_turmas AS (
      SELECT category_id
      FROM teacher_categories
      WHERE teacher_id = ${id}
    ),
    videos AS (
      SELECT m.id
      FROM materials m
      WHERE m.file_type = 'video'
        AND m.language = ${teacher.locale}
        AND (
          m.category_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_turmas tt
            WHERE tt.category_id = m.category_id
          )
        )
        AND (
          m.student_year IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_student_years tys
            WHERE tys.teacher_id = ${id}
              AND tys.student_year = m.student_year
          )
        )
        AND (
          COALESCE(m.access_scope, 'all') = 'all'
          OR EXISTS (
            SELECT 1
            FROM material_teacher_access mta
            WHERE mta.material_id = m.id
              AND mta.teacher_id = ${id}
          )
        )
    ),
    progress AS (
      SELECT p.progress_percent, p.watched_at
      FROM teacher_video_progress p
      JOIN videos v ON v.id = p.material_id
      WHERE p.teacher_id = ${id}
    )
    SELECT
      (SELECT COUNT(*)::int FROM videos) AS total_videos,
      (SELECT COUNT(*)::int FROM progress WHERE progress_percent > 0) AS started_videos,
      (SELECT COUNT(*)::int FROM progress WHERE progress_percent >= 70 OR watched_at IS NOT NULL) AS watched_videos,
      COALESCE((SELECT ROUND(AVG(progress_percent)::numeric, 1) FROM progress), 0) AS avg_progress
  `

  const recentProgress = await db`
    WITH teacher_turmas AS (
      SELECT category_id
      FROM teacher_categories
      WHERE teacher_id = ${id}
    ),
    videos AS (
      SELECT m.id, m.title
      FROM materials m
      WHERE m.file_type = 'video'
        AND m.language = ${teacher.locale}
        AND (
          m.category_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_turmas tt
            WHERE tt.category_id = m.category_id
          )
        )
        AND (
          m.student_year IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_student_years tys
            WHERE tys.teacher_id = ${id}
              AND tys.student_year = m.student_year
          )
        )
        AND (
          COALESCE(m.access_scope, 'all') = 'all'
          OR EXISTS (
            SELECT 1
            FROM material_teacher_access mta
            WHERE mta.material_id = m.id
              AND mta.teacher_id = ${id}
          )
        )
    )
    SELECT v.id, v.title, p.progress_percent, p.updated_at
    FROM teacher_video_progress p
    JOIN videos v ON v.id = p.material_id
    WHERE p.teacher_id = ${id}
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT 10
  `

  const [lessonSummary] = await db`
    SELECT
      COUNT(*)::int AS total_logs,
      COUNT(DISTINCT class_label)::int AS class_count,
      MAX(lesson_date)::text AS last_lesson_date
    FROM teacher_lesson_logs
    WHERE teacher_id = ${id}
  `

  const lessonClasses = await db`
    WITH classes AS (
      SELECT DISTINCT class_label
      FROM teacher_schedules
      WHERE teacher_id = ${id}
      UNION
      SELECT DISTINCT class_label
      FROM teacher_lesson_logs
      WHERE teacher_id = ${id}
    ),
    last_logs AS (
      SELECT class_label,
             MAX(lesson_number) AS last_lesson,
             MAX(lesson_date) AS last_date
      FROM teacher_lesson_logs
      WHERE teacher_id = ${id}
      GROUP BY class_label
    )
    SELECT
      c.class_label,
      COALESCE(l.last_lesson, 0)::int AS last_lesson,
      l.last_date::text AS last_date
    FROM classes c
    LEFT JOIN last_logs l ON l.class_label = c.class_label
    ORDER BY c.class_label ASC
  `

  return NextResponse.json({
    logs,
    videoSummary: summary ?? {
      total_videos: 0,
      started_videos: 0,
      watched_videos: 0,
      avg_progress: 0,
    },
    recentProgress,
    lessonSummary: lessonSummary ?? {
      total_logs: 0,
      class_count: 0,
      last_lesson_date: null,
    },
    lessonClasses: Array.isArray(lessonClasses)
      ? lessonClasses.map((item) => ({
          ...item,
          next_lesson: (Number(item.last_lesson) || 0) + 1,
        }))
      : [],
  })
}
