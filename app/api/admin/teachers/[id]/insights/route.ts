import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const [teacher] = await db`
    SELECT id, locale
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `

  if (!teacher) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })
  }

  const logs = await db`
    SELECT id, action, status, request_path, created_at
    FROM audit_logs
    WHERE actor_id = ${id}
    ORDER BY created_at DESC
    LIMIT 20
  `

  const [summary] = await db`
    WITH vids AS (
      SELECT id
      FROM materials
      WHERE file_type = 'video'
        AND language = ${teacher.locale}
    ),
    progress AS (
      SELECT p.progress_percent, p.watched_at
      FROM teacher_video_progress p
      JOIN materials m ON m.id = p.material_id
      WHERE p.teacher_id = ${id}
        AND m.file_type = 'video'
        AND m.language = ${teacher.locale}
    )
    SELECT
      (SELECT COUNT(*)::int FROM vids) AS total_videos,
      (SELECT COUNT(*)::int FROM progress WHERE progress_percent > 0) AS started_videos,
      (SELECT COUNT(*)::int FROM progress WHERE progress_percent >= 70 OR watched_at IS NOT NULL) AS watched_videos,
      COALESCE((SELECT ROUND(AVG(progress_percent)::numeric, 1) FROM progress), 0) AS avg_progress
  `

  const recentProgress = await db`
    SELECT m.id, m.title, p.progress_percent, p.updated_at
    FROM teacher_video_progress p
    JOIN materials m ON m.id = p.material_id
    WHERE p.teacher_id = ${id}
      AND m.file_type = 'video'
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
