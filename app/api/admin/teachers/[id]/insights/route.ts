import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureGradebookSchema } from "@/lib/gradebook"
import { ensureTurmasSchema } from "@/lib/turmas"
import { ensureAuditSchema } from "@/lib/audit-schema"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()
  await ensureGradebookSchema()
  await ensureAuditSchema()

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }
  const schoolYear = new Date().getFullYear()

  const [teacher] = await db`
    SELECT id, locale
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `

  if (!teacher) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  // Intentionally no automatic delete here.
  // Reconciliation/deletion must be explicit to avoid accidental grade loss.

  let logs: any[] = []
  try {
    const auditColumnsRows = await db`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
    `
    const auditColumns = new Set(
      (Array.isArray(auditColumnsRows) ? auditColumnsRows : [])
        .map((row: any) => String(row?.column_name ?? "").trim().toLowerCase())
        .filter(Boolean),
    )

    const hasActorId = auditColumns.has("actor_id")
    const hasCreatedAt = auditColumns.has("created_at")
    const hasId = auditColumns.has("id")
    const hasAction = auditColumns.has("action")
    const hasStatus = auditColumns.has("status")
    const hasRequestPath = auditColumns.has("request_path")

    if (hasActorId && hasCreatedAt) {
      if (hasId) {
        logs = await db`
          SELECT
            id::text AS id,
            ${hasAction ? db`action` : db`'audit_log'::text`} AS action,
            ${hasStatus ? db`status` : db`NULL::text`} AS status,
            ${hasRequestPath ? db`request_path` : db`NULL::text`} AS request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE actor_id = ${id}
          ORDER BY created_at DESC
          LIMIT 20
        `
      } else {
        logs = await db`
          SELECT
            md5(created_at::text || ':' || row_number() OVER (ORDER BY created_at DESC)::text) AS id,
            ${hasAction ? db`action` : db`'audit_log'::text`} AS action,
            ${hasStatus ? db`status` : db`NULL::text`} AS status,
            ${hasRequestPath ? db`request_path` : db`NULL::text`} AS request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE actor_id = ${id}
          ORDER BY created_at DESC
          LIMIT 20
        `
      }
    }
  } catch {
    logs = []
  }

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

  const gradebookClasses = await db`
    SELECT
      c.id,
      c.name,
      c.student_year,
      c.school_year,
      c.active,
      COUNT(DISTINCT s.id)::int AS student_count,
      COUNT(DISTINCT s.id) FILTER (WHERE s.active = TRUE)::int AS active_student_count,
      COUNT(DISTINCT ll.id)::int AS lesson_count,
      MAX(ll.lesson_date)::text AS last_lesson_date,
      MAX(ll.lesson_number)::int AS last_lesson_number
    FROM teacher_classes c
    LEFT JOIN teacher_class_students s
      ON s.class_id = c.id
    LEFT JOIN teacher_lesson_logs ll
      ON ll.teacher_id = c.teacher_id
     AND COALESCE(ll.school_year::int, EXTRACT(YEAR FROM ll.lesson_date)::int) = ${schoolYear}
     AND (
       ll.class_id = c.id
       OR (
         ll.class_id IS NULL
         AND lower(trim(ll.class_label)) = lower(trim(c.name))
       )
     )
    WHERE c.teacher_id = ${id}
      AND c.school_year = ${schoolYear}
    GROUP BY c.id
    ORDER BY c.active DESC, c.name ASC
  `

  const gradebookStudents = await db`
    WITH class_scope AS (
      SELECT id
      FROM teacher_classes
      WHERE teacher_id = ${id}
        AND school_year = ${schoolYear}
    ),
    bimesters AS (
      SELECT 1 AS bimester
      UNION ALL SELECT 2
      UNION ALL SELECT 3
      UNION ALL SELECT 4
    ),
    entry_metrics AS (
      SELECT
        l.class_id,
        e.student_id,
        l.bimester,
        COUNT(*)::int AS entries_count,
        COUNT(*) FILTER (WHERE e.attendance = 'present')::int AS presence_count,
        COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absence_count,
        ROUND(
          AVG((e.c1 + e.c2 + e.c3 + e.c4) / 4.0)
          FILTER (
            WHERE e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL
          )::numeric,
          2
        ) AS note1
      FROM teacher_grade_entries e
      JOIN teacher_grade_lessons l ON l.id = e.lesson_id
      JOIN class_scope cs ON cs.id = l.class_id
      WHERE l.school_year = ${schoolYear}
      GROUP BY l.class_id, e.student_id, l.bimester
    ),
    per_bimester AS (
      SELECT
        s.class_id,
        s.id AS student_id,
        s.full_name,
        s.active,
        b.bimester,
        COALESCE(em.entries_count, 0)::int AS entries_count,
        COALESCE(em.presence_count, 0)::int AS presence_count,
        COALESCE(em.absence_count, 0)::int AS absence_count,
        CASE
          WHEN bg.manual_final_score IS NOT NULL THEN bg.manual_final_score
          WHEN em.note1 IS NOT NULL
           AND (
             (bg.exam_score IS NOT NULL AND bg.c5_score IS NOT NULL)
             OR (bg.exam_score IS NULL AND bg.c5_score IS NOT NULL)
           )
            THEN ROUND(
              (
                em.note1 + (
                  CASE
                    WHEN bg.exam_score IS NOT NULL
                      THEN ((bg.exam_score + bg.c5_score) / 2.0)
                    ELSE bg.c5_score
                  END
                )
              ) / 2.0
            , 2)
          ELSE NULL
        END AS final_grade
      FROM teacher_class_students s
      JOIN class_scope cs ON cs.id = s.class_id
      CROSS JOIN bimesters b
      LEFT JOIN entry_metrics em
        ON em.class_id = s.class_id
       AND em.student_id = s.id
       AND em.bimester = b.bimester
      LEFT JOIN teacher_bimester_grades bg
        ON bg.class_id = s.class_id
       AND bg.student_id = s.id
       AND bg.school_year = ${schoolYear}
       AND bg.bimester = b.bimester
    )
    SELECT
      pb.class_id,
      pb.student_id,
      pb.full_name,
      pb.active,
      SUM(pb.entries_count)::int AS entries_count,
      SUM(pb.presence_count)::int AS presence_count,
      SUM(pb.absence_count)::int AS absence_count,
      CASE
        WHEN SUM(pb.entries_count) > 0
          THEN ROUND((SUM(pb.presence_count)::numeric / SUM(pb.entries_count)::numeric) * 100.0, 2)
        ELSE NULL
      END AS attendance_percent,
      MAX(pb.final_grade) FILTER (WHERE pb.bimester = 1) AS b1_final_grade,
      MAX(pb.final_grade) FILTER (WHERE pb.bimester = 2) AS b2_final_grade,
      MAX(pb.final_grade) FILTER (WHERE pb.bimester = 3) AS b3_final_grade,
      MAX(pb.final_grade) FILTER (WHERE pb.bimester = 4) AS b4_final_grade
    FROM per_bimester pb
    GROUP BY pb.class_id, pb.student_id, pb.full_name, pb.active
    ORDER BY pb.class_id ASC, pb.full_name ASC
  `

  const gradebookRecentLessons = await db`
    SELECT
      l.id,
      l.class_id,
      c.name AS class_name,
      l.bimester,
      l.lesson_number,
      l.lesson_date::text AS lesson_date,
      l.notes,
      COUNT(e.student_id)::int AS entries_count,
      COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absences_count
    FROM teacher_grade_lessons l
    JOIN teacher_classes c
      ON c.id = l.class_id
    LEFT JOIN teacher_grade_entries e
      ON e.lesson_id = l.id
    WHERE l.teacher_id = ${id}
      AND l.school_year = ${schoolYear}
    GROUP BY l.id, c.name
    ORDER BY l.lesson_date DESC, l.lesson_number DESC
    LIMIT 15
  `

  const gradebookLocks = await db`
    SELECT
      l.class_id,
      l.bimester,
      l.locked_at::text AS locked_at,
      l.locked_by_teacher_id
    FROM teacher_gradebook_bimester_locks l
    JOIN teacher_classes c
      ON c.id = l.class_id
    WHERE c.teacher_id = ${id}
      AND l.school_year = ${schoolYear}
  `

  const studentsByClass = new Map<string, any[]>()
  for (const row of gradebookStudents) {
    const classId = String(row.class_id)
    if (!studentsByClass.has(classId)) studentsByClass.set(classId, [])
    studentsByClass.get(classId)?.push({
      student_id: row.student_id,
      full_name: row.full_name,
      active: row.active === true,
      entries_count: Number(row.entries_count ?? 0),
      presence_count: Number(row.presence_count ?? 0),
      absence_count: Number(row.absence_count ?? 0),
      attendance_percent:
        row.attendance_percent === null || row.attendance_percent === undefined
          ? null
          : Number(row.attendance_percent),
      b1_final_grade: row.b1_final_grade === null ? null : Number(row.b1_final_grade),
      b2_final_grade: row.b2_final_grade === null ? null : Number(row.b2_final_grade),
      b3_final_grade: row.b3_final_grade === null ? null : Number(row.b3_final_grade),
      b4_final_grade: row.b4_final_grade === null ? null : Number(row.b4_final_grade),
    })
  }

  const lockMap = new Map<string, { locked_at: string | null; locked_by_teacher_id: string | null }>()
  for (const row of gradebookLocks) {
    lockMap.set(`${row.class_id}:${row.bimester}`, {
      locked_at: row.locked_at ?? null,
      locked_by_teacher_id: row.locked_by_teacher_id ?? null,
    })
  }

  const normalizedGradebookClasses = gradebookClasses.map((item) => {
    const classId = String(item.id)
    const students = studentsByClass.get(classId) ?? []
    const activeStudents = students.filter((student) => student.active === true)
    const totalForBimester = activeStudents.length > 0 ? activeStudents.length : students.length

    const bimesters = [1, 2, 3, 4].map((bimester) => {
      const key = `b${bimester}_final_grade` as const
      const studentsWithFinal = students.reduce((total, student) => {
        if (student[key] === null || student[key] === undefined) return total
        return total + 1
      }, 0)
      const lock = lockMap.get(`${classId}:${bimester}`)
      return {
        bimester,
        students_with_final: studentsWithFinal,
        total_students: totalForBimester,
        closed: !!lock,
        locked_at: lock?.locked_at ?? null,
        locked_by_teacher_id: lock?.locked_by_teacher_id ?? null,
      }
    })

    return {
      id: item.id,
      name: item.name,
      student_year: item.student_year,
      school_year: Number(item.school_year ?? schoolYear),
      active: item.active === true,
      student_count: Number(item.student_count ?? 0),
      active_student_count: Number(item.active_student_count ?? 0),
      lesson_count: Number(item.lesson_count ?? 0),
      last_lesson_date: item.last_lesson_date ?? null,
      last_lesson_number: item.last_lesson_number === null ? null : Number(item.last_lesson_number),
      students,
      bimesters,
    }
  })

  const gradebookOverview = {
    school_year: schoolYear,
    class_count: normalizedGradebookClasses.length,
    active_class_count: normalizedGradebookClasses.filter((item) => item.active === true).length,
    student_count: gradebookStudents.length,
    active_student_count: gradebookStudents.filter((item) => item.active === true).length,
    lesson_count: normalizedGradebookClasses.reduce(
      (total, item) => total + Number(item.lesson_count ?? 0),
      0,
    ),
  }

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
    gradebook: {
      school_year: schoolYear,
      overview: gradebookOverview,
      classes: normalizedGradebookClasses,
      recent_lessons: gradebookRecentLessons.map((item) => ({
        id: item.id,
        class_id: item.class_id,
        class_name: item.class_name,
        bimester: Number(item.bimester ?? 0),
        lesson_number: Number(item.lesson_number ?? 0),
        lesson_date: item.lesson_date ?? null,
        notes: item.notes ?? null,
        entries_count: Number(item.entries_count ?? 0),
        absences_count: Number(item.absences_count ?? 0),
      })),
    },
  })
}
