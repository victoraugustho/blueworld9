import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { searchParams } = new URL(req.url)
  const teacherId = String(searchParams.get("teacherId") ?? "").trim()
  const limitRaw = Number(searchParams.get("limit") ?? 200)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200

  if (!teacherId) {
    return NextResponse.json({ error: "teacherId obrigatório" }, { status: 400 })
  }

  const rows = await db`
    WITH logs AS (
      SELECT
        l.*,
        COALESCE(l.class_id, sch.class_id) AS resolved_class_id,
        COALESCE(
          NULLIF(trim(l.class_label), ''),
          NULLIF(trim(c_log.name), ''),
          NULLIF(trim(c_sch.name), ''),
          'Sem turma'
        ) AS resolved_class_label,
        COALESCE(
          l.bimester,
          CASE
            WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 1 AND 3 THEN 1
            WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 4 AND 6 THEN 2
            WHEN EXTRACT(MONTH FROM l.lesson_date)::int BETWEEN 7 AND 9 THEN 3
            ELSE 4
          END
        ) AS resolved_bimester
      FROM teacher_lesson_logs l
      LEFT JOIN teacher_schedules sch
        ON sch.id = l.schedule_id
       AND sch.teacher_id = l.teacher_id
      LEFT JOIN teacher_classes c_log
        ON c_log.id = l.class_id
      LEFT JOIN teacher_classes c_sch
        ON c_sch.id = sch.class_id
      WHERE l.teacher_id = ${teacherId}
      ORDER BY l.lesson_date DESC NULLS LAST, l.lesson_number DESC, l.created_at DESC
      LIMIT ${limit}
    )
    SELECT
      logs.*,
      gl.id AS grade_lesson_id,
      gl.has_grades AS grade_has_grades,
      COALESCE(metrics.total_students, 0)::int AS total_students,
      COALESCE(metrics.graded_students, 0)::int AS graded_students,
      CASE
        WHEN COALESCE(gl.has_grades, TRUE) = FALSE THEN 100
        WHEN COALESCE(metrics.total_students, 0) > 0
          THEN ROUND((COALESCE(metrics.completed_students, 0)::numeric / metrics.total_students::numeric) * 100.0, 2)
        ELSE 0
      END AS completion_percent,
      CASE
        WHEN COALESCE(gl.has_grades, TRUE) = FALSE THEN TRUE
        WHEN COALESCE(metrics.total_students, 0) > 0
          THEN COALESCE(metrics.completed_students, 0) >= metrics.total_students
        ELSE FALSE
      END AS fully_completed
    FROM logs
    LEFT JOIN LATERAL (
      SELECT g.*
      FROM teacher_grade_lessons g
      WHERE g.teacher_id = logs.teacher_id
        AND g.class_id = logs.resolved_class_id
        AND g.lesson_number = logs.lesson_number
        AND g.bimester = logs.resolved_bimester
      ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC
      LIMIT 1
    ) gl ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(s.id)::int AS total_students,
        COUNT(*) FILTER (
          WHERE e.c1 IS NOT NULL
            AND e.c2 IS NOT NULL
            AND e.c3 IS NOT NULL
            AND e.c4 IS NOT NULL
        )::int AS graded_students,
        COUNT(*) FILTER (
          WHERE e.attendance = 'absent'
             OR (e.c1 IS NOT NULL
            AND e.c2 IS NOT NULL
            AND e.c3 IS NOT NULL
            AND e.c4 IS NOT NULL)
        )::int AS completed_students
      FROM teacher_class_students s
      LEFT JOIN teacher_grade_entries e
        ON e.student_id = s.id
       AND e.lesson_id = gl.id
      WHERE s.class_id = logs.resolved_class_id
        AND (
          logs.lesson_date IS NULL
          OR COALESCE(NULLIF(to_jsonb(s)->>'enrollment_at', '')::date, s.created_at::date) <= logs.lesson_date::date
        )
    ) metrics ON logs.resolved_class_id IS NOT NULL
    ORDER BY logs.lesson_date DESC NULLS LAST, logs.lesson_number DESC, logs.created_at DESC
  `

  return NextResponse.json(rows)
}
