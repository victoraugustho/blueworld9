import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureAuditSchema } from "@/lib/audit-schema"

const AUDIT_TYPES = [
  "auth",
  "gradebook",
  "agenda",
  "materials",
  "projects",
  "blog",
  "notifications",
  "admin",
  "system",
  "other",
] as const

const AUDIT_RELEVANCE_LEVELS = ["critical", "high", "medium", "low"] as const

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

function isAuditType(value: string): value is (typeof AUDIT_TYPES)[number] {
  return (AUDIT_TYPES as readonly string[]).includes(value)
}

function isAuditRelevance(value: string): value is (typeof AUDIT_RELEVANCE_LEVELS)[number] {
  return (AUDIT_RELEVANCE_LEVELS as readonly string[]).includes(value)
}

function buildWhere(filters: any[]) {
  if (filters.length === 0) return db``
  let condition = filters[0]
  for (let i = 1; i < filters.length; i += 1) {
    condition = db`${condition} AND ${filters[i]}`
  }
  return db`WHERE ${condition}`
}

const AUDIT_TYPE_SQL = db`
  CASE
    WHEN action ILIKE 'auth.%'
      OR request_path ILIKE '/api/portal/login%'
      OR request_path ILIKE '/api/portal/logout%'
      OR request_path ILIKE '/api/portal/recover-password%'
      OR request_path ILIKE '/api/portal/reset-password%'
    THEN 'auth'
    WHEN action ILIKE 'gradebook.%'
      OR request_path ILIKE '/api/portal/gradebook%'
      OR request_path ILIKE '/api/portal/lesson-logs%'
      OR request_path ILIKE '/api/portal/bimester%'
    THEN 'gradebook'
    WHEN action ILIKE 'agenda.%'
      OR action ILIKE 'schedule.%'
      OR request_path ILIKE '/api/portal/teacher-schedules%'
      OR request_path ILIKE '/api/admin/teacher-schedules%'
      OR request_path ILIKE '/api/portal/reminders%'
    THEN 'agenda'
    WHEN action ILIKE 'material.%'
      OR request_path ILIKE '/api/admin/materials%'
      OR request_path ILIKE '/api/portal/materials%'
    THEN 'materials'
    WHEN action ILIKE 'project.%'
      OR request_path ILIKE '/api/admin/projects%'
      OR request_path ILIKE '/api/portal/projects%'
    THEN 'projects'
    WHEN action ILIKE 'blog.%'
      OR request_path ILIKE '/api/admin/blog%'
      OR request_path ILIKE '/api/blog%'
    THEN 'blog'
    WHEN action ILIKE 'notification.%'
      OR request_path ILIKE '/api/portal/notifications%'
      OR request_path ILIKE '/api/admin/special-notifications%'
    THEN 'notifications'
    WHEN request_path ILIKE '/api/admin/%'
    THEN 'admin'
    WHEN action ILIKE 'system.%' OR actor_id IS NULL
    THEN 'system'
    ELSE 'other'
  END
`

const AUDIT_RELEVANCE_SQL = db`
  CASE
    -- Operacoes criticas: impacto alto, mesmo quando bem-sucedidas
    WHEN (
      (
        COALESCE(request_method, '') = 'DELETE'
        AND action NOT ILIKE 'notifications.unread%'
        AND action NOT ILIKE 'notifications.read%'
      )
      OR action ILIKE '%delete%'
      OR action ILIKE '%remove%'
      OR action ILIKE '%revoke%'
      OR action ILIKE '%transfer%'
      OR action ILIKE '%ownership%'
      OR action ILIKE '%lock%'
      OR action ILIKE '%close%'
      OR action ILIKE 'auth.password_reset.confirm%'
      OR request_path ILIKE '/api/admin/%/ownership%'
      OR request_path ILIKE '/api/admin/%/transfer%'
    )
    THEN 'critical'

    -- Falhas nao criticas: ainda relevantes para acompanhamento
    WHEN COALESCE(status, 'success') = 'failed'
    THEN 'high'

    -- Acoes operacionais de baixo risco/rotina
    WHEN (
      action ILIKE 'auth.login%'
      OR action ILIKE 'auth.logout%'
      OR action ILIKE 'notifications.read%'
      OR action ILIKE 'notifications.unread%'
      OR action ILIKE 'notifications.list%'
      OR action ILIKE '%.list%'
      OR action ILIKE '%.view%'
      OR action ILIKE '%.fetch%'
      OR action ILIKE '%.read%'
      OR COALESCE(request_method, '') = 'GET'
    )
    THEN 'low'

    -- Escritas de negocio (nao destrutivas)
    WHEN COALESCE(request_method, '') IN ('POST', 'PUT', 'PATCH')
      OR action ILIKE '%create%'
      OR action ILIKE '%update%'
      OR action ILIKE '%publish%'
      OR action ILIKE '%assign%'
    THEN 'medium'

    ELSE 'low'
  END
`

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureAuditSchema()

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const status = (searchParams.get("status") ?? "").trim()
  const action = (searchParams.get("action") ?? "").trim()
  const actor = (searchParams.get("actor") ?? "").trim()
  const from = (searchParams.get("from") ?? "").trim()
  const to = (searchParams.get("to") ?? "").trim()
  const type = (searchParams.get("type") ?? "").trim()
  const relevance = (searchParams.get("relevance") ?? "").trim()

  const limit = Math.min(100, Math.max(1, toInt(searchParams.get("limit"), 50)))
  const offset = toInt(searchParams.get("offset"), 0)

  const filters: any[] = []

  if (status && status !== "all") {
    filters.push(db`status = ${status}`)
  }
  if (type && type !== "all" && isAuditType(type)) {
    filters.push(db`log_type = ${type}`)
  }
  if (relevance && relevance !== "all" && isAuditRelevance(relevance)) {
    filters.push(db`relevance_level = ${relevance}`)
  }
  if (action) {
    filters.push(db`action = ${action}`)
  }
  if (actor) {
    const like = `%${actor}%`
    filters.push(db`(actor_email ILIKE ${like} OR actor_id::text ILIKE ${like})`)
  }
  if (q) {
    const like = `%${q}%`
    filters.push(
      db`(action ILIKE ${like} OR actor_email ILIKE ${like} OR request_path ILIKE ${like} OR target_id ILIKE ${like} OR target_type ILIKE ${like})`
    )
  }
  if (from) {
    filters.push(db`created_at >= ${from}`)
  }
  if (to) {
    filters.push(db`created_at <= ${to}`)
  }

  const where = buildWhere(filters)

  const [countRow] = await db`
    WITH base AS (
      SELECT
        *,
        ${AUDIT_TYPE_SQL} AS log_type,
        ${AUDIT_RELEVANCE_SQL} AS relevance_level
      FROM public.audit_logs
    )
    SELECT COUNT(*)::int AS count
    FROM base
    ${where}
  `

  const rows = await db`
    WITH base AS (
      SELECT
        *,
        ${AUDIT_TYPE_SQL} AS log_type,
        ${AUDIT_RELEVANCE_SQL} AS relevance_level
      FROM public.audit_logs
    )
    SELECT *
    FROM base
    ${where}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const [summaryRow] = await db`
    WITH base AS (
      SELECT
        *,
        ${AUDIT_TYPE_SQL} AS log_type,
        ${AUDIT_RELEVANCE_SQL} AS relevance_level
      FROM public.audit_logs
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(status, 'success') = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE relevance_level = 'critical')::int AS critical,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
    FROM base
    ${where}
  `

  const typeRows = await db`
    WITH base AS (
      SELECT
        ${AUDIT_TYPE_SQL} AS log_type,
        ${AUDIT_RELEVANCE_SQL} AS relevance_level,
        status,
        created_at,
        action,
        actor_id,
        actor_email,
        request_path,
        target_id,
        target_type
      FROM public.audit_logs
    )
    SELECT log_type, COUNT(*)::int AS count
    FROM base
    ${where}
    GROUP BY log_type
    ORDER BY count DESC, log_type ASC
  `

  const relevanceRows = await db`
    WITH base AS (
      SELECT
        ${AUDIT_TYPE_SQL} AS log_type,
        ${AUDIT_RELEVANCE_SQL} AS relevance_level,
        status,
        created_at,
        action,
        actor_id,
        actor_email,
        request_path,
        target_id,
        target_type
      FROM public.audit_logs
    )
    SELECT relevance_level, COUNT(*)::int AS count
    FROM base
    ${where}
    GROUP BY relevance_level
    ORDER BY
      CASE relevance_level
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END
  `

  const typeCounts = Object.fromEntries(
    AUDIT_TYPES.map((entry) => {
      const row = typeRows.find((item: any) => item.log_type === entry)
      return [entry, row?.count ?? 0]
    })
  )

  const relevanceCounts = Object.fromEntries(
    AUDIT_RELEVANCE_LEVELS.map((entry) => {
      const row = relevanceRows.find((item: any) => item.relevance_level === entry)
      return [entry, row?.count ?? 0]
    })
  )

  return NextResponse.json({
    total: countRow?.count ?? 0,
    items: rows,
    summary: {
      total: summaryRow?.total ?? 0,
      failed: summaryRow?.failed ?? 0,
      critical: summaryRow?.critical ?? 0,
      last24h: summaryRow?.last_24h ?? 0,
      typeCounts,
      relevanceCounts,
    },
  })
}
