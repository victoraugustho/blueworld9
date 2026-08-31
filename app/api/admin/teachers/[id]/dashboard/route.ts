import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { normalizeSchoolYear, ensureGradebookSchema } from "@/lib/gradebook"
import { ensureTurmasSchema } from "@/lib/turmas"
import { ensureAuditSchema } from "@/lib/audit-schema"

type Ctx = { params: Promise<{ id: string }> }

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function todayIsoDate() {
  const now = new Date()
  return toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
}

function daysAgoIsoDate(days: number) {
  const now = new Date()
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  utc.setUTCDate(utc.getUTCDate() - days + 1)
  return toIsoDate(utc)
}

function parseIsoDate(value: string | null) {
  const parsed = String(value ?? "").trim()
  if (!parsed) return null
  if (!ISO_DATE_RE.test(parsed)) return null
  const date = new Date(`${parsed}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return parsed
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, places = 1) {
  if (!Number.isFinite(value)) return 0
  const factor = Math.pow(10, places)
  return Math.round(value * factor) / factor
}

function diffDaysInclusive(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00Z`)
  const toDate = new Date(`${to}T00:00:00Z`)
  const ms = toDate.getTime() - fromDate.getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.floor(ms / 86400000) + 1
}

function activityFreshnessScore(lastActivityAt: string | null) {
  if (!lastActivityAt) return 0
  const ts = new Date(lastActivityAt).getTime()
  if (Number.isNaN(ts)) return 0
  const now = Date.now()
  const days = (now - ts) / 86400000
  if (days <= 7) return 100
  if (days <= 14) return 75
  if (days <= 30) return 45
  return 15
}

function performanceLevel(score: number) {
  if (score >= 85) return "excelente"
  if (score >= 70) return "bom"
  if (score >= 50) return "atencao"
  return "critico"
}

function isLoginAction(action: unknown) {
  const normalized = String(action ?? "").trim().toLowerCase()
  return normalized.startsWith("auth.login")
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureTurmasSchema()
  await ensureGradebookSchema()
  let auditSchemaReady = true
  try {
    await ensureAuditSchema()
  } catch {
    auditSchemaReady = false
  }

  const resolved = await ctx.params
  const id = String(resolved?.id ?? "").trim()

  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  const searchParams = new URL(req.url).searchParams
  const schoolYear = normalizeSchoolYear(searchParams.get("schoolYear"))
  if (schoolYear === null) {
    return NextResponse.json({ error: "Ano letivo invalido" }, { status: 400 })
  }

  const fromQuery = parseIsoDate(searchParams.get("from"))
  const toQuery = parseIsoDate(searchParams.get("to"))
  if (searchParams.get("from") && !fromQuery) {
    return NextResponse.json({ error: "Data inicial invalida" }, { status: 400 })
  }
  if (searchParams.get("to") && !toQuery) {
    return NextResponse.json({ error: "Data final invalida" }, { status: 400 })
  }

  const toDate = toQuery ?? todayIsoDate()
  const fromDate = fromQuery ?? daysAgoIsoDate(30)
  if (fromDate > toDate) {
    return NextResponse.json({ error: "Periodo invalido" }, { status: 400 })
  }
  const periodDays = diffDaysInclusive(fromDate, toDate)

  const [teacher] = await db`
    SELECT
      id,
      name,
      email,
      phone,
      country,
      locale,
      document_type,
      document_number,
      approved,
      active,
      created_at,
      updated_at
    FROM teachers
    WHERE id = ${id}
    LIMIT 1
  `

  if (!teacher) {
    return NextResponse.json({ error: "Professor nao encontrado" }, { status: 404 })
  }

  const categories = await db`
    SELECT c.id, c.name
    FROM teacher_categories tc
    JOIN categories c ON c.id = tc.category_id
    WHERE tc.teacher_id = ${id}
    ORDER BY c.name ASC
  `

  const [yearRow] = await db`
    SELECT
      COALESCE(
        ARRAY_AGG(tys.student_year ORDER BY tys.student_year),
        ARRAY[]::smallint[]
      ) AS student_years
    FROM teacher_student_years tys
    WHERE tys.teacher_id = ${id}
  `

  const [sessionSummary] = await db`
    WITH scoped AS (
      SELECT created_at, expires_at, revoked_at
      FROM teacher_sessions
      WHERE teacher_id = ${id}
    ),
    period_scoped AS (
      SELECT created_at
      FROM scoped
      WHERE created_at >= ${fromDate}::date
        AND created_at < (${toDate}::date + INTERVAL '1 day')
    )
    SELECT
      (SELECT MAX(created_at)::text FROM scoped) AS last_login_at,
      (SELECT COUNT(*)::int FROM period_scoped) AS login_count_period,
      (SELECT COUNT(*)::int FROM scoped WHERE revoked_at IS NULL AND expires_at > NOW()) AS active_sessions
  `

  const [latestSession] = await db`
    SELECT created_at::text AS created_at, ip, user_agent
    FROM teacher_sessions
    WHERE teacher_id = ${id}
    ORDER BY created_at DESC
    LIMIT 1
  `

  let auditSummary: any = {
    total_actions: 0,
    success_actions: 0,
    failed_actions: 0,
    unique_actions: 0,
    unique_paths: 0,
    last_activity_in_period: null,
  }
  let dailyActivity: any[] = []
  let recentLogs: any[] = []
  let latestActivity: any = { created_at: null }
  let topActions: any[] = []

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

  const hasAuditActorId = auditColumns.has("actor_id")
  const hasAuditActorEmail = auditColumns.has("actor_email")
  const hasAuditCreatedAt = auditColumns.has("created_at")
  const hasAuditAction = auditColumns.has("action")
  const hasAuditStatus = auditColumns.has("status")
  const hasAuditRequestPath = auditColumns.has("request_path")
  const hasAuditId = auditColumns.has("id")
  const teacherEmail = String(teacher?.email ?? "").trim()

  const auditActorWhere =
    hasAuditActorId && hasAuditActorEmail && teacherEmail
      ? db`(actor_id = ${id} OR (actor_id IS NULL AND lower(actor_email) = lower(${teacherEmail})))`
      : hasAuditActorId
        ? db`actor_id = ${id}`
        : hasAuditActorEmail && teacherEmail
          ? db`lower(actor_email) = lower(${teacherEmail})`
          : null

  if (hasAuditCreatedAt && auditActorWhere) {
    try {
    if (hasAuditAction && hasAuditStatus && hasAuditRequestPath) {
      ;[auditSummary] = await db`
        WITH scoped AS (
          SELECT action, status, request_path, created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
        )
        SELECT
          COUNT(*)::int AS total_actions,
          COUNT(*) FILTER (WHERE COALESCE(status, 'success') = 'success')::int AS success_actions,
          COUNT(*) FILTER (WHERE COALESCE(status, 'success') = 'failed')::int AS failed_actions,
          COUNT(DISTINCT action)::int AS unique_actions,
          COUNT(DISTINCT request_path)::int AS unique_paths,
          MAX(created_at)::text AS last_activity_in_period
      `

      dailyActivity = await db`
        SELECT
          created_at::date::text AS day,
          COUNT(*)::int AS total_actions,
          COUNT(*) FILTER (WHERE COALESCE(status, 'success') = 'failed')::int AS failed_actions
        FROM public.audit_logs
        WHERE ${auditActorWhere}
          AND created_at >= ${fromDate}::date
          AND created_at < (${toDate}::date + INTERVAL '1 day')
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
      `

      if (hasAuditId) {
        recentLogs = await db`
          SELECT
            id::text AS id,
            action,
            status,
            request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 60
        `
      } else {
        recentLogs = await db`
          SELECT
            md5(created_at::text || ':' || row_number() OVER (ORDER BY created_at DESC)::text) AS id,
            action,
            status,
            request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 60
        `
      }
    } else if (hasAuditAction) {
      ;[auditSummary] = await db`
        WITH scoped AS (
          SELECT action, created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
        )
        SELECT
          COUNT(*)::int AS total_actions,
          COUNT(*)::int AS success_actions,
          0::int AS failed_actions,
          COUNT(DISTINCT action)::int AS unique_actions,
          0::int AS unique_paths,
          MAX(created_at)::text AS last_activity_in_period
      `

      dailyActivity = await db`
        SELECT
          created_at::date::text AS day,
          COUNT(*)::int AS total_actions,
          0::int AS failed_actions
        FROM public.audit_logs
        WHERE ${auditActorWhere}
          AND created_at >= ${fromDate}::date
          AND created_at < (${toDate}::date + INTERVAL '1 day')
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
      `

      if (hasAuditId) {
        recentLogs = await db`
          SELECT
            id::text AS id,
            action,
            NULL::text AS status,
            NULL::text AS request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 60
        `
      } else {
        recentLogs = await db`
          SELECT
            md5(created_at::text || ':' || row_number() OVER (ORDER BY created_at DESC)::text) AS id,
            action,
            NULL::text AS status,
            NULL::text AS request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 60
        `
      }
    } else {
      ;[auditSummary] = await db`
        WITH scoped AS (
          SELECT created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
        )
        SELECT
          COUNT(*)::int AS total_actions,
          COUNT(*)::int AS success_actions,
          0::int AS failed_actions,
          0::int AS unique_actions,
          0::int AS unique_paths,
          MAX(created_at)::text AS last_activity_in_period
      `

      dailyActivity = await db`
        SELECT
          created_at::date::text AS day,
          COUNT(*)::int AS total_actions,
          0::int AS failed_actions
        FROM public.audit_logs
        WHERE ${auditActorWhere}
          AND created_at >= ${fromDate}::date
          AND created_at < (${toDate}::date + INTERVAL '1 day')
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
      `

      if (hasAuditId) {
        recentLogs = await db`
          SELECT
            id::text AS id,
            'audit_log'::text AS action,
            NULL::text AS status,
            NULL::text AS request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 60
        `
      } else {
        recentLogs = await db`
          SELECT
            md5(created_at::text || ':' || row_number() OVER (ORDER BY created_at DESC)::text) AS id,
            'audit_log'::text AS action,
            NULL::text AS status,
            NULL::text AS request_path,
            created_at::text AS created_at
          FROM public.audit_logs
          WHERE ${auditActorWhere}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')
          ORDER BY created_at DESC
          LIMIT 60
        `
      }
    }

    ;[latestActivity] = await db`
      SELECT created_at::text AS created_at
      FROM public.audit_logs
      WHERE ${auditActorWhere}
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (hasAuditAction) {
      topActions = await db`
        SELECT
          action,
          COUNT(*)::int AS total
        FROM public.audit_logs
        WHERE ${auditActorWhere}
          AND created_at >= ${fromDate}::date
          AND created_at < (${toDate}::date + INTERVAL '1 day')
        GROUP BY action
        ORDER BY total DESC, action ASC
        LIMIT 12
      `
    } else {
      topActions = []
    }
    } catch (error: any) {
      const code = String(error?.code ?? "")
      const message = String(error?.message ?? "").toLowerCase()
      const missingCompatColumn = code === "42703" || message.includes("column")

      if (!missingCompatColumn) {
        throw error
      }
      auditSummary = {
        total_actions: 0,
        success_actions: 0,
        failed_actions: 0,
        unique_actions: 0,
        unique_paths: 0,
        last_activity_in_period: null,
      }
      dailyActivity = []
      recentLogs = []
      latestActivity = { created_at: null }
      topActions = []
    }
  }

  if (recentLogs.length === 0 && toNumber(sessionSummary?.login_count_period) > 0) {
    const fallbackSessionLogs = await db`
      SELECT
        md5(created_at::text || ':' || row_number() OVER (ORDER BY created_at DESC)::text) AS id,
        'auth.login'::text AS action,
        'success'::text AS status,
        '/api/portal/login'::text AS request_path,
        created_at::text AS created_at
      FROM teacher_sessions
      WHERE teacher_id = ${id}
        AND created_at >= ${fromDate}::date
        AND created_at < (${toDate}::date + INTERVAL '1 day')
      ORDER BY created_at DESC
      LIMIT 60
    `

    const [fallbackDailySummary] = await db`
      SELECT
        COUNT(*)::int AS total_actions,
        MAX(created_at)::text AS last_activity_in_period
      FROM teacher_sessions
      WHERE teacher_id = ${id}
        AND created_at >= ${fromDate}::date
        AND created_at < (${toDate}::date + INTERVAL '1 day')
    `

    const fallbackDailyActivity = await db`
      SELECT
        created_at::date::text AS day,
        COUNT(*)::int AS total_actions,
        0::int AS failed_actions
      FROM teacher_sessions
      WHERE teacher_id = ${id}
        AND created_at >= ${fromDate}::date
        AND created_at < (${toDate}::date + INTERVAL '1 day')
      GROUP BY created_at::date
      ORDER BY created_at::date ASC
    `

    recentLogs = fallbackSessionLogs
    dailyActivity = fallbackDailyActivity
    topActions = [{ action: "auth.login", total: toNumber(fallbackDailySummary?.total_actions) }]

    if (toNumber(auditSummary?.total_actions) === 0) {
      auditSummary = {
        total_actions: toNumber(fallbackDailySummary?.total_actions),
        success_actions: toNumber(fallbackDailySummary?.total_actions),
        failed_actions: 0,
        unique_actions: 1,
        unique_paths: 1,
        last_activity_in_period: fallbackDailySummary?.last_activity_in_period ?? null,
      }
    }

    if (!latestActivity?.created_at) {
      ;[latestActivity] = await db`
        SELECT MAX(created_at)::text AS created_at
        FROM teacher_sessions
        WHERE teacher_id = ${id}
      `
    }
  }

  const onlyLoginTopActions =
    topActions.length > 0 && topActions.every((item) => String(item?.action ?? "") === "auth.login")

  if (recentLogs.length === 0 || onlyLoginTopActions) {
    try {
      const derivedLogs = await db`
        WITH events AS (
          SELECT
            created_at AS event_at,
            'auth.login'::text AS action,
            'success'::text AS status,
            '/api/portal/login'::text AS request_path
          FROM teacher_sessions
          WHERE teacher_id = ${id}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')

          UNION ALL

          SELECT
            created_at AS event_at,
            'teacher.lesson_log.create'::text AS action,
            'success'::text AS status,
            '/api/portal/lesson-logs'::text AS request_path
          FROM teacher_lesson_logs
          WHERE teacher_id = ${id}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')

          UNION ALL

          SELECT
            updated_at AS event_at,
            'teacher.lesson_log.update'::text AS action,
            'success'::text AS status,
            '/api/portal/lesson-logs'::text AS request_path
          FROM teacher_lesson_logs
          WHERE teacher_id = ${id}
            AND updated_at > created_at
            AND updated_at >= ${fromDate}::date
            AND updated_at < (${toDate}::date + INTERVAL '1 day')

          UNION ALL

          SELECT
            created_at AS event_at,
            'teacher.reminder.create'::text AS action,
            'success'::text AS status,
            '/api/portal/reminders'::text AS request_path
          FROM teacher_reminders
          WHERE teacher_id = ${id}
            AND created_at >= ${fromDate}::date
            AND created_at < (${toDate}::date + INTERVAL '1 day')

          UNION ALL

          SELECT
            updated_at AS event_at,
            'teacher.reminder.update'::text AS action,
            'success'::text AS status,
            '/api/portal/reminders'::text AS request_path
          FROM teacher_reminders
          WHERE teacher_id = ${id}
            AND updated_at > created_at
            AND updated_at >= ${fromDate}::date
            AND updated_at < (${toDate}::date + INTERVAL '1 day')

          UNION ALL

          SELECT
            updated_at AS event_at,
            'teacher.video.progress'::text AS action,
            'success'::text AS status,
            '/api/portal/video-progress'::text AS request_path
          FROM teacher_video_progress
          WHERE teacher_id = ${id}
            AND updated_at >= ${fromDate}::date
            AND updated_at < (${toDate}::date + INTERVAL '1 day')
        )
        SELECT
          md5(event_at::text || ':' || action || ':' || row_number() OVER (ORDER BY event_at DESC)::text) AS id,
          action,
          status,
          request_path,
          event_at::text AS created_at
        FROM events
        ORDER BY event_at DESC
        LIMIT 120
      `

      if (Array.isArray(derivedLogs) && derivedLogs.length > 0) {
        const derivedDaily = await db`
          WITH events AS (
            SELECT created_at AS event_at
            FROM teacher_sessions
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT created_at AS event_at
            FROM teacher_lesson_logs
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT updated_at AS event_at
            FROM teacher_lesson_logs
            WHERE teacher_id = ${id}
              AND updated_at > created_at
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT created_at AS event_at
            FROM teacher_reminders
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT updated_at AS event_at
            FROM teacher_reminders
            WHERE teacher_id = ${id}
              AND updated_at > created_at
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT updated_at AS event_at
            FROM teacher_video_progress
            WHERE teacher_id = ${id}
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')
          )
          SELECT
            event_at::date::text AS day,
            COUNT(*)::int AS total_actions,
            0::int AS failed_actions
          FROM events
          GROUP BY event_at::date
          ORDER BY event_at::date ASC
        `

        const derivedTopActions = await db`
          WITH events AS (
            SELECT 'auth.login'::text AS action, created_at AS event_at
            FROM teacher_sessions
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT 'teacher.lesson_log.create'::text AS action, created_at AS event_at
            FROM teacher_lesson_logs
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT 'teacher.lesson_log.update'::text AS action, updated_at AS event_at
            FROM teacher_lesson_logs
            WHERE teacher_id = ${id}
              AND updated_at > created_at
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT 'teacher.reminder.create'::text AS action, created_at AS event_at
            FROM teacher_reminders
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT 'teacher.reminder.update'::text AS action, updated_at AS event_at
            FROM teacher_reminders
            WHERE teacher_id = ${id}
              AND updated_at > created_at
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT 'teacher.video.progress'::text AS action, updated_at AS event_at
            FROM teacher_video_progress
            WHERE teacher_id = ${id}
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')
          )
          SELECT action, COUNT(*)::int AS total
          FROM events
          GROUP BY action
          ORDER BY total DESC, action ASC
          LIMIT 12
        `

        const [derivedSummary] = await db`
          WITH events AS (
            SELECT created_at AS event_at
            FROM teacher_sessions
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT created_at AS event_at
            FROM teacher_lesson_logs
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT updated_at AS event_at
            FROM teacher_lesson_logs
            WHERE teacher_id = ${id}
              AND updated_at > created_at
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT created_at AS event_at
            FROM teacher_reminders
            WHERE teacher_id = ${id}
              AND created_at >= ${fromDate}::date
              AND created_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT updated_at AS event_at
            FROM teacher_reminders
            WHERE teacher_id = ${id}
              AND updated_at > created_at
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')

            UNION ALL

            SELECT updated_at AS event_at
            FROM teacher_video_progress
            WHERE teacher_id = ${id}
              AND updated_at >= ${fromDate}::date
              AND updated_at < (${toDate}::date + INTERVAL '1 day')
          )
          SELECT
            COUNT(*)::int AS total_actions,
            MAX(event_at)::text AS last_activity_in_period
          FROM events
        `

        recentLogs = derivedLogs
        dailyActivity = derivedDaily
        topActions = derivedTopActions
        auditSummary = {
          total_actions: toNumber(derivedSummary?.total_actions),
          success_actions: toNumber(derivedSummary?.total_actions),
          failed_actions: 0,
          unique_actions: derivedTopActions.length,
          unique_paths: toNumber(auditSummary?.unique_paths),
          last_activity_in_period: derivedSummary?.last_activity_in_period ?? null,
        }

        if (!latestActivity?.created_at) {
          ;[latestActivity] = await db`
            WITH events AS (
              SELECT MAX(created_at) AS at
              FROM teacher_sessions
              WHERE teacher_id = ${id}

              UNION ALL

              SELECT MAX(created_at) AS at
              FROM teacher_lesson_logs
              WHERE teacher_id = ${id}

              UNION ALL

              SELECT MAX(updated_at) AS at
              FROM teacher_lesson_logs
              WHERE teacher_id = ${id}

              UNION ALL

              SELECT MAX(updated_at) AS at
              FROM teacher_reminders
              WHERE teacher_id = ${id}

              UNION ALL

              SELECT MAX(updated_at) AS at
              FROM teacher_video_progress
              WHERE teacher_id = ${id}
            )
            SELECT MAX(at)::text AS created_at
            FROM events
          `
        }
      }
    } catch {
      // keep previous values when derived activity cannot be computed
    }
  }

  const loginActionsInPeriod = (Array.isArray(topActions) ? topActions : []).reduce((acc, row) => {
    if (!isLoginAction(row?.action)) return acc
    return acc + toNumber(row?.total)
  }, 0)
  const totalActionsInPeriod = toNumber(auditSummary?.total_actions)
  const operationalActionsInPeriod = Math.max(0, totalActionsInPeriod - loginActionsInPeriod)

  const lastOperationalInPeriod =
    (Array.isArray(recentLogs) ? recentLogs : []).find((row) => !isLoginAction(row?.action))?.created_at ?? null

  const [lastOperationalLesson] = await db`
    SELECT GREATEST(
      COALESCE(MAX(created_at), '-infinity'::timestamptz),
      COALESCE(MAX(updated_at), '-infinity'::timestamptz)
    )::text AS created_at
    FROM teacher_lesson_logs
    WHERE teacher_id = ${id}
  `

  const [lastOperationalReminder] = await db`
    SELECT GREATEST(
      COALESCE(MAX(created_at), '-infinity'::timestamptz),
      COALESCE(MAX(updated_at), '-infinity'::timestamptz)
    )::text AS created_at
    FROM teacher_reminders
    WHERE teacher_id = ${id}
  `

  const [lastOperationalVideo] = await db`
    SELECT MAX(updated_at)::text AS created_at
    FROM teacher_video_progress
    WHERE teacher_id = ${id}
  `

  let lastOperationalAuditAt: string | null = null
  if (hasAuditCreatedAt && auditActorWhere) {
    const [row] = await db`
      SELECT MAX(created_at)::text AS created_at
      FROM public.audit_logs
      WHERE ${auditActorWhere}
        AND (
          action IS NULL
          OR lower(trim(action)) <> 'auth.login'
        )
    `
    lastOperationalAuditAt = row?.created_at ?? null
  }

  const lastOperationalCandidates = [
    lastOperationalAuditAt,
    lastOperationalLesson?.created_at ?? null,
    lastOperationalReminder?.created_at ?? null,
    lastOperationalVideo?.created_at ?? null,
  ]
    .filter(Boolean)
    .map((value) => {
      const parsed = new Date(String(value)).getTime()
      return Number.isNaN(parsed) ? null : { value: String(value), ts: parsed }
    })
    .filter((item): item is { value: string; ts: number } => item !== null)
    .sort((a, b) => b.ts - a.ts)

  const lastOperationalActivityAt = lastOperationalCandidates.length > 0 ? lastOperationalCandidates[0].value : null

  const [scheduleSummary] = await db`
    SELECT
      COUNT(*)::int AS total_slots,
      COUNT(*) FILTER (WHERE active = TRUE)::int AS active_slots,
      COUNT(*) FILTER (WHERE entry_type = 'class')::int AS class_slots,
      COUNT(*) FILTER (WHERE entry_type = 'event')::int AS event_slots,
      COUNT(*) FILTER (WHERE is_recurring = TRUE)::int AS recurring_slots,
      COUNT(*) FILTER (WHERE is_recurring = FALSE)::int AS one_off_slots,
      COUNT(*) FILTER (
        WHERE is_recurring = FALSE
          AND event_date >= ${fromDate}::date
          AND event_date <= ${toDate}::date
      )::int AS one_off_in_period
    FROM teacher_schedules
    WHERE teacher_id = ${id}
  `

  const [lessonSummary] = await db`
    WITH scoped AS (
      SELECT
        class_id,
        class_label,
        lesson_date,
        COALESCE(has_grades, TRUE) AS has_grades,
        NULLIF(TRIM(COALESCE(notes, '')), '') AS notes_norm,
        NULLIF(TRIM(COALESCE(observations, '')), '') AS observations_norm
      FROM teacher_lesson_logs
      WHERE teacher_id = ${id}
        AND lesson_date >= ${fromDate}::date
        AND lesson_date <= ${toDate}::date
    )
    SELECT
      COUNT(*)::int AS total_lessons,
      COUNT(DISTINCT COALESCE(class_id::text, LOWER(TRIM(class_label))))::int AS classes_touched,
      COUNT(*) FILTER (WHERE has_grades = TRUE)::int AS lessons_with_grades,
      COUNT(*) FILTER (WHERE has_grades = FALSE)::int AS lessons_without_grades,
      COUNT(*) FILTER (WHERE notes_norm IS NOT NULL)::int AS lessons_with_notes,
      COUNT(*) FILTER (WHERE observations_norm IS NOT NULL)::int AS lessons_with_observations,
      MAX(lesson_date)::text AS last_lesson_date
    FROM scoped
  `

  const lessonsByClass = await db`
    SELECT
      COALESCE(c.name, l.class_label, 'Sem turma') AS class_name,
      COUNT(*)::int AS lessons_count,
      MAX(l.lesson_date)::text AS last_lesson_date
    FROM teacher_lesson_logs l
    LEFT JOIN teacher_classes c
      ON c.id = l.class_id
    WHERE l.teacher_id = ${id}
      AND l.lesson_date >= ${fromDate}::date
      AND l.lesson_date <= ${toDate}::date
    GROUP BY COALESCE(c.name, l.class_label, 'Sem turma')
    ORDER BY lessons_count DESC, class_name ASC
    LIMIT 16
  `

  const recentLessons = await db`
    SELECT
      l.id,
      COALESCE(c.name, l.class_label, 'Sem turma') AS class_name,
      l.lesson_date::text AS lesson_date,
      l.lesson_number,
      l.bimester,
      COALESCE(l.has_grades, TRUE) AS has_grades,
      l.notes,
      l.observations
    FROM teacher_lesson_logs l
    LEFT JOIN teacher_classes c
      ON c.id = l.class_id
    WHERE l.teacher_id = ${id}
      AND l.lesson_date >= ${fromDate}::date
      AND l.lesson_date <= ${toDate}::date
    ORDER BY l.lesson_date DESC, l.lesson_number DESC, l.created_at DESC
    LIMIT 60
  `

  const [gradeProgressSummary] = await db`
    WITH lesson_scope AS (
      SELECT
        l.id,
        l.class_id,
        l.lesson_date,
        COALESCE(l.has_grades, TRUE) AS has_grades
      FROM teacher_grade_lessons l
      JOIN teacher_classes c
        ON c.id = l.class_id
      WHERE c.teacher_id = ${id}
        AND c.school_year = ${schoolYear}
        AND l.school_year = ${schoolYear}
        AND l.lesson_date >= ${fromDate}::date
        AND l.lesson_date <= ${toDate}::date
    ),
    lesson_students AS (
      SELECT
        l.id AS lesson_id,
        s.id AS student_id
      FROM lesson_scope l
      LEFT JOIN teacher_class_students s
        ON s.class_id = l.class_id
       AND s.active = TRUE
       AND s.created_at::date <= l.lesson_date::date
    ),
    lesson_metrics AS (
      SELECT
        l.id AS lesson_id,
        l.class_id,
        l.has_grades,
        COUNT(ls.student_id)::int AS expected_students,
        COUNT(*) FILTER (
          WHERE e.attendance = 'absent'
             OR (
              e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL
            )
        )::int AS graded_students,
        COUNT(*) FILTER (
          WHERE e.attendance = 'absent'
             OR (e.c1 IS NOT NULL
            AND e.c2 IS NOT NULL
            AND e.c3 IS NOT NULL
            AND e.c4 IS NOT NULL)
        )::int AS completed_students,
        COUNT(*) FILTER (WHERE e.attendance IN ('present', 'absent'))::int AS attendance_students,
        COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absence_students
      FROM lesson_scope l
      LEFT JOIN lesson_students ls
        ON ls.lesson_id = l.id
      LEFT JOIN teacher_grade_entries e
        ON e.lesson_id = l.id
       AND e.student_id = ls.student_id
      GROUP BY l.id, l.class_id, l.has_grades
    )
    SELECT
      COUNT(*)::int AS grade_lessons_count,
      COALESCE(SUM(expected_students), 0)::int AS expected_students_total,
      COALESCE(
        SUM(
          CASE
            WHEN has_grades = TRUE THEN completed_students
            ELSE expected_students
          END
        ),
        0
      )::int AS completed_students_total,
      COALESCE(SUM(attendance_students), 0)::int AS attendance_marked_total,
      COALESCE(SUM(absence_students), 0)::int AS absences_total,
      COUNT(*) FILTER (
        WHERE CASE
          WHEN has_grades = TRUE THEN (expected_students = 0 OR completed_students >= expected_students)
          ELSE TRUE
        END
      )::int AS fully_completed_lessons,
      COUNT(*) FILTER (WHERE has_grades = FALSE)::int AS no_grade_lessons
    FROM lesson_metrics
  `

  const gradeByClass = await db`
    WITH lesson_scope AS (
      SELECT
        l.id,
        l.class_id,
        l.lesson_date,
        COALESCE(l.has_grades, TRUE) AS has_grades
      FROM teacher_grade_lessons l
      JOIN teacher_classes c
        ON c.id = l.class_id
      WHERE c.teacher_id = ${id}
        AND c.school_year = ${schoolYear}
        AND l.school_year = ${schoolYear}
        AND l.lesson_date >= ${fromDate}::date
        AND l.lesson_date <= ${toDate}::date
    ),
    lesson_students AS (
      SELECT
        l.id AS lesson_id,
        s.id AS student_id
      FROM lesson_scope l
      LEFT JOIN teacher_class_students s
        ON s.class_id = l.class_id
       AND s.active = TRUE
       AND s.created_at::date <= l.lesson_date::date
    ),
    lesson_metrics AS (
      SELECT
        l.id AS lesson_id,
        l.class_id,
        l.has_grades,
        COUNT(ls.student_id)::int AS expected_students,
        COUNT(*) FILTER (
          WHERE e.attendance = 'absent'
             OR (
              e.c1 IS NOT NULL
              AND e.c2 IS NOT NULL
              AND e.c3 IS NOT NULL
              AND e.c4 IS NOT NULL
            )
        )::int AS graded_students,
        COUNT(*) FILTER (
          WHERE e.attendance = 'absent'
             OR (e.c1 IS NOT NULL
            AND e.c2 IS NOT NULL
            AND e.c3 IS NOT NULL
            AND e.c4 IS NOT NULL)
        )::int AS completed_students,
        COUNT(*) FILTER (WHERE e.attendance = 'absent')::int AS absences_total
      FROM lesson_scope l
      LEFT JOIN lesson_students ls
        ON ls.lesson_id = l.id
      LEFT JOIN teacher_grade_entries e
        ON e.lesson_id = l.id
       AND e.student_id = ls.student_id
      GROUP BY l.id, l.class_id, l.has_grades
    )
    SELECT
      c.id,
      c.name,
      c.student_year,
      c.active,
      COUNT(ls.id)::int AS lessons_count,
      COALESCE(SUM(lm.expected_students), 0)::int AS expected_students_total,
      COALESCE(
        SUM(
          CASE
            WHEN lm.has_grades = TRUE THEN lm.completed_students
            ELSE lm.expected_students
          END
        ),
        0
      )::int AS completed_students_total,
      COALESCE(SUM(lm.absences_total), 0)::int AS absences_total,
      MAX(ls.lesson_date)::text AS last_lesson_date
    FROM teacher_classes c
    LEFT JOIN lesson_scope ls
      ON ls.class_id = c.id
    LEFT JOIN lesson_metrics lm
      ON lm.lesson_id = ls.id
    WHERE c.teacher_id = ${id}
      AND c.school_year = ${schoolYear}
    GROUP BY c.id
    ORDER BY lessons_count DESC, c.name ASC
  `

  const [finalGradesCoverage] = await db`
    WITH class_scope AS (
      SELECT id
      FROM teacher_classes
      WHERE teacher_id = ${id}
        AND school_year = ${schoolYear}
    ),
    active_students AS (
      SELECT
        s.class_id,
        s.id AS student_id
      FROM teacher_class_students s
      JOIN class_scope c
        ON c.id = s.class_id
      WHERE s.active = TRUE
    ),
    targets AS (
      SELECT
        a.class_id,
        a.student_id,
        b.bimester
      FROM active_students a
      CROSS JOIN (VALUES (1), (2), (3), (4)) AS b(bimester)
    ),
    grades AS (
      SELECT
        g.class_id,
        g.student_id,
        g.bimester,
        g.has_exam,
        g.exam_score,
        g.c5_score,
        g.manual_final_score
      FROM teacher_bimester_grades g
      JOIN class_scope c
        ON c.id = g.class_id
      WHERE g.school_year = ${schoolYear}
    )
    SELECT
      COUNT(*)::int AS total_targets,
      COUNT(*) FILTER (
        WHERE g.manual_final_score IS NOT NULL
          OR (COALESCE(g.has_exam, FALSE) = TRUE AND g.exam_score IS NOT NULL AND g.c5_score IS NOT NULL)
          OR (COALESCE(g.has_exam, FALSE) = FALSE AND g.c5_score IS NOT NULL)
      )::int AS completed_targets
    FROM targets t
    LEFT JOIN grades g
      ON g.class_id = t.class_id
     AND g.student_id = t.student_id
     AND g.bimester = t.bimester
  `

  const finalCoverageByBimester = await db`
    WITH class_scope AS (
      SELECT id
      FROM teacher_classes
      WHERE teacher_id = ${id}
        AND school_year = ${schoolYear}
    ),
    active_students AS (
      SELECT
        s.class_id,
        s.id AS student_id
      FROM teacher_class_students s
      JOIN class_scope c
        ON c.id = s.class_id
      WHERE s.active = TRUE
    ),
    targets AS (
      SELECT
        a.class_id,
        a.student_id,
        b.bimester
      FROM active_students a
      CROSS JOIN (VALUES (1), (2), (3), (4)) AS b(bimester)
    ),
    grades AS (
      SELECT
        g.class_id,
        g.student_id,
        g.bimester,
        g.has_exam,
        g.exam_score,
        g.c5_score,
        g.manual_final_score
      FROM teacher_bimester_grades g
      JOIN class_scope c
        ON c.id = g.class_id
      WHERE g.school_year = ${schoolYear}
    ),
    locks AS (
      SELECT class_id, bimester
      FROM teacher_gradebook_bimester_locks
      WHERE school_year = ${schoolYear}
        AND class_id IN (SELECT id FROM class_scope)
    )
    SELECT
      t.bimester,
      COUNT(*)::int AS total_targets,
      COUNT(*) FILTER (
        WHERE g.manual_final_score IS NOT NULL
          OR (COALESCE(g.has_exam, FALSE) = TRUE AND g.exam_score IS NOT NULL AND g.c5_score IS NOT NULL)
          OR (COALESCE(g.has_exam, FALSE) = FALSE AND g.c5_score IS NOT NULL)
      )::int AS completed_targets,
      COUNT(DISTINCT t.class_id)::int AS class_count,
      COUNT(DISTINCT t.class_id) FILTER (WHERE l.class_id IS NOT NULL)::int AS closed_class_count
    FROM targets t
    LEFT JOIN grades g
      ON g.class_id = t.class_id
     AND g.student_id = t.student_id
     AND g.bimester = t.bimester
    LEFT JOIN locks l
      ON l.class_id = t.class_id
     AND l.bimester = t.bimester
    GROUP BY t.bimester
    ORDER BY t.bimester ASC
  `

  const [gradebookOverview] = await db`
    WITH class_scope AS (
      SELECT id, active
      FROM teacher_classes
      WHERE teacher_id = ${id}
        AND school_year = ${schoolYear}
    )
    SELECT
      (SELECT COUNT(*)::int FROM class_scope) AS class_count,
      (SELECT COUNT(*)::int FROM class_scope WHERE active = TRUE) AS active_class_count,
      (
        SELECT COUNT(*)::int
        FROM teacher_class_students s
        JOIN class_scope c
          ON c.id = s.class_id
      ) AS student_count,
      (
        SELECT COUNT(*)::int
        FROM teacher_class_students s
        JOIN class_scope c
          ON c.id = s.class_id
        WHERE s.active = TRUE
      ) AS active_student_count,
      (
        SELECT COUNT(*)::int
        FROM teacher_grade_lessons l
        JOIN class_scope c
          ON c.id = l.class_id
        WHERE l.school_year = ${schoolYear}
      ) AS lesson_count
  `

  const [remindersSummary] = await db`
    SELECT
      COUNT(*)::int AS total_reminders,
      COUNT(*) FILTER (WHERE done = TRUE)::int AS done_reminders,
      COUNT(*) FILTER (WHERE done = FALSE)::int AS pending_reminders,
      COUNT(*) FILTER (
        WHERE created_at >= ${fromDate}::date
          AND created_at < (${toDate}::date + INTERVAL '1 day')
      )::int AS created_in_period,
      MAX(updated_at)::text AS last_update_at
    FROM teacher_reminders
    WHERE teacher_id = ${id}
  `

  const [videoAll] = await db`
    SELECT
      COUNT(*)::int AS tracked_videos,
      COUNT(*) FILTER (WHERE progress_percent > 0)::int AS started_videos,
      COUNT(*) FILTER (WHERE progress_percent >= 70 OR watched_at IS NOT NULL)::int AS watched_videos,
      COALESCE(ROUND(AVG(progress_percent)::numeric, 1), 0) AS avg_progress
    FROM teacher_video_progress
    WHERE teacher_id = ${id}
  `

  const [videoInPeriod] = await db`
    SELECT
      COUNT(*)::int AS tracked_videos,
      COUNT(*) FILTER (WHERE progress_percent > 0)::int AS started_videos,
      COUNT(*) FILTER (WHERE progress_percent >= 70 OR watched_at IS NOT NULL)::int AS watched_videos,
      COALESCE(ROUND(AVG(progress_percent)::numeric, 1), 0) AS avg_progress
    FROM teacher_video_progress
    WHERE teacher_id = ${id}
      AND updated_at >= ${fromDate}::date
      AND updated_at < (${toDate}::date + INTERVAL '1 day')
  `

  const recentVideoProgress = await db`
    SELECT
      p.material_id AS id,
      COALESCE(m.title, 'Material') AS title,
      p.progress_percent,
      p.updated_at::text AS updated_at
    FROM teacher_video_progress p
    LEFT JOIN materials m
      ON m.id = p.material_id
    WHERE p.teacher_id = ${id}
      AND p.updated_at >= ${fromDate}::date
      AND p.updated_at < (${toDate}::date + INTERVAL '1 day')
    ORDER BY p.updated_at DESC
    LIMIT 20
  `

  const expectedEntries = toNumber(gradeProgressSummary?.expected_students_total)
  const completedEntries = toNumber(gradeProgressSummary?.completed_students_total)
  const attendanceMarked = toNumber(gradeProgressSummary?.attendance_marked_total)
  const finalTargets = toNumber(finalGradesCoverage?.total_targets)
  const finalCompleted = toNumber(finalGradesCoverage?.completed_targets)

  const lessonCoveragePercent =
    toNumber(lessonSummary?.total_lessons) > 0
      ? round((toNumber(lessonSummary?.lessons_with_notes) / toNumber(lessonSummary?.total_lessons)) * 100, 1)
      : 0
  const launchCompletionPercent =
    expectedEntries > 0 ? round((completedEntries / expectedEntries) * 100, 1) : 100
  const attendanceCoveragePercent =
    expectedEntries > 0 ? round((attendanceMarked / expectedEntries) * 100, 1) : 100
  const finalCoveragePercent = finalTargets > 0 ? round((finalCompleted / finalTargets) * 100, 1) : 0
  const freshness = activityFreshnessScore(latestActivity?.created_at ?? null)

  const performanceIndex = round(
    lessonCoveragePercent * 0.25 +
      launchCompletionPercent * 0.35 +
      finalCoveragePercent * 0.3 +
      freshness * 0.1,
    1,
  )

  const alerts: string[] = []
  if (toNumber(lessonSummary?.total_lessons) === 0) {
    alerts.push("Nenhuma aula registrada no periodo selecionado.")
  }
  if (launchCompletionPercent < 70) {
    alerts.push("Cobertura de lancamento de notas abaixo de 70%.")
  }
  if (finalTargets > 0 && finalCoveragePercent < 70) {
    alerts.push("Cobertura de notas finais do bimestre abaixo de 70%.")
  }
  if (freshness < 45) {
    alerts.push("Baixa atividade recente no portal.")
  }

  return NextResponse.json({
    teacher: {
      ...teacher,
      categories,
      student_years: Array.isArray(yearRow?.student_years)
        ? yearRow.student_years.map((value: unknown) => toNumber(value))
        : [],
    },
    period: {
      from: fromDate,
      to: toDate,
      days: periodDays,
      school_year: schoolYear,
    },
    kpis: {
      performance_index: performanceIndex,
      performance_level: performanceLevel(performanceIndex),
      lesson_diary_coverage_percent: lessonCoveragePercent,
      launch_completion_percent: launchCompletionPercent,
      attendance_coverage_percent: attendanceCoveragePercent,
      final_grades_coverage_percent: finalCoveragePercent,
      freshness_score: freshness,
      alerts,
    },
    access: {
      last_login_at: sessionSummary?.last_login_at ?? null,
      login_count_period: toNumber(sessionSummary?.login_count_period),
      active_sessions: toNumber(sessionSummary?.active_sessions),
      last_session: latestSession ?? null,
      last_activity_at: lastOperationalActivityAt ?? latestActivity?.created_at ?? null,
      last_operational_activity_at: lastOperationalActivityAt,
    },
    activity: {
      summary: {
        total_actions: toNumber(auditSummary?.total_actions),
        success_actions: toNumber(auditSummary?.success_actions),
        failed_actions: toNumber(auditSummary?.failed_actions),
        unique_actions: toNumber(auditSummary?.unique_actions),
        unique_paths: toNumber(auditSummary?.unique_paths),
        last_activity_in_period: auditSummary?.last_activity_in_period ?? null,
        last_operational_activity_in_period: lastOperationalInPeriod,
        login_actions: loginActionsInPeriod,
        operational_actions: operationalActionsInPeriod,
      },
      top_actions: topActions.map((row) => ({
        action: row.action,
        total: toNumber(row.total),
      })),
      daily_activity: dailyActivity.map((row) => ({
        day: row.day,
        total_actions: toNumber(row.total_actions),
        failed_actions: toNumber(row.failed_actions),
      })),
      recent_logs: recentLogs,
    },
    agenda: {
      total_slots: toNumber(scheduleSummary?.total_slots),
      active_slots: toNumber(scheduleSummary?.active_slots),
      class_slots: toNumber(scheduleSummary?.class_slots),
      event_slots: toNumber(scheduleSummary?.event_slots),
      recurring_slots: toNumber(scheduleSummary?.recurring_slots),
      one_off_slots: toNumber(scheduleSummary?.one_off_slots),
      one_off_in_period: toNumber(scheduleSummary?.one_off_in_period),
    },
    lessons: {
      total_lessons: toNumber(lessonSummary?.total_lessons),
      classes_touched: toNumber(lessonSummary?.classes_touched),
      lessons_with_grades: toNumber(lessonSummary?.lessons_with_grades),
      lessons_without_grades: toNumber(lessonSummary?.lessons_without_grades),
      lessons_with_notes: toNumber(lessonSummary?.lessons_with_notes),
      lessons_with_observations: toNumber(lessonSummary?.lessons_with_observations),
      last_lesson_date: lessonSummary?.last_lesson_date ?? null,
      by_class: lessonsByClass.map((row) => ({
        class_name: row.class_name,
        lessons_count: toNumber(row.lessons_count),
        last_lesson_date: row.last_lesson_date ?? null,
      })),
      recent: recentLessons,
    },
    gradebook: {
      overview: {
        class_count: toNumber(gradebookOverview?.class_count),
        active_class_count: toNumber(gradebookOverview?.active_class_count),
        student_count: toNumber(gradebookOverview?.student_count),
        active_student_count: toNumber(gradebookOverview?.active_student_count),
        lesson_count: toNumber(gradebookOverview?.lesson_count),
      },
      progress_period: {
        grade_lessons_count: toNumber(gradeProgressSummary?.grade_lessons_count),
        expected_students_total: expectedEntries,
        completed_students_total: completedEntries,
        attendance_marked_total: attendanceMarked,
        absences_total: toNumber(gradeProgressSummary?.absences_total),
        fully_completed_lessons: toNumber(gradeProgressSummary?.fully_completed_lessons),
        no_grade_lessons: toNumber(gradeProgressSummary?.no_grade_lessons),
      },
      final_coverage: {
        total_targets: finalTargets,
        completed_targets: finalCompleted,
        by_bimester: finalCoverageByBimester.map((row) => ({
          bimester: toNumber(row.bimester),
          total_targets: toNumber(row.total_targets),
          completed_targets: toNumber(row.completed_targets),
          class_count: toNumber(row.class_count),
          closed_class_count: toNumber(row.closed_class_count),
        })),
      },
      classes: gradeByClass.map((row) => {
        const classExpected = toNumber(row.expected_students_total)
        const classCompleted = toNumber(row.completed_students_total)
        return {
          id: row.id,
          name: row.name,
          student_year: row.student_year === null ? null : toNumber(row.student_year),
          active: row.active === true,
          lessons_count: toNumber(row.lessons_count),
          expected_students_total: classExpected,
          completed_students_total: classCompleted,
          completion_percent:
            classExpected > 0 ? round((classCompleted / classExpected) * 100, 1) : 100,
          absences_total: toNumber(row.absences_total),
          last_lesson_date: row.last_lesson_date ?? null,
        }
      }),
    },
    reminders: {
      total: toNumber(remindersSummary?.total_reminders),
      done: toNumber(remindersSummary?.done_reminders),
      pending: toNumber(remindersSummary?.pending_reminders),
      created_in_period: toNumber(remindersSummary?.created_in_period),
      last_update_at: remindersSummary?.last_update_at ?? null,
    },
    video: {
      all_time: {
        tracked_videos: toNumber(videoAll?.tracked_videos),
        started_videos: toNumber(videoAll?.started_videos),
        watched_videos: toNumber(videoAll?.watched_videos),
        avg_progress: toNullableNumber(videoAll?.avg_progress) ?? 0,
      },
      in_period: {
        tracked_videos: toNumber(videoInPeriod?.tracked_videos),
        started_videos: toNumber(videoInPeriod?.started_videos),
        watched_videos: toNumber(videoInPeriod?.watched_videos),
        avg_progress: toNullableNumber(videoInPeriod?.avg_progress) ?? 0,
      },
      recent_progress: recentVideoProgress.map((row) => ({
        id: row.id,
        title: row.title,
        progress_percent: toNullableNumber(row.progress_percent) ?? 0,
        updated_at: row.updated_at ?? null,
      })),
    },
  })
}
