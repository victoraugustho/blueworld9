import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { ensureAuditSchema } from "@/lib/audit-schema"
import { SESSION_COOKIE } from "@/lib/auth/constants"
import { hashSessionToken } from "@/lib/auth/session"

type AuditStatus = "success" | "failed"

type AuditActor = {
  id?: string | null
  email?: string | null
  name?: string | null
  role?: string | null
  sessionId?: string | null
}

type AuditTarget = {
  type?: string | null
  id?: string | number | null
}

type AuditInput = {
  req?: NextRequest
  actor?: AuditActor
  action: string
  status?: AuditStatus
  target?: AuditTarget
  metadata?: Record<string, any> | null
}

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "authorization",
  "cookie",
  "session",
  "document_number",
  "cpf",
  "secret",
])

const RETENTION_MONTHS = 12
const PURGE_INTERVAL_MS = 1000 * 60 * 60
let lastPurgeAt = 0

function normalizeKey(key: string) {
  return key.trim().toLowerCase()
}

function safeString(value: any, max = 300) {
  const text = String(value ?? "")
  if (text.length <= max) return text
  return text.slice(0, max) + "...(truncated)"
}

function sanitize(value: any, depth = 0): any {
  if (value == null) return value
  if (depth > 4) return "[Truncated]"

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1))
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "object") {
    const output: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key))) {
        output[key] = "[REDACTED]"
        continue
      }
      output[key] = sanitize(val, depth + 1)
    }
    return output
  }

  if (typeof value === "string") return safeString(value)
  return value
}

function getIp(req: NextRequest | undefined) {
  if (!req) return null
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return null
}

async function inferActorFromRequest(req?: NextRequest): Promise<AuditActor | null> {
  if (!req) return null

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const tokenHash = hashSessionToken(token)
    const [row] = await db`
      SELECT
        s.id AS session_id,
        t.id,
        t.email,
        t.name,
        t.role,
        t.is_admin
      FROM teacher_sessions s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE s.token_hash = ${tokenHash}
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1
    `

    if (!row) return null

    const role =
      row.is_admin === true
        ? "admin"
        : row.role
          ? String(row.role)
          : "teacher"

    return {
      id: row.id ? String(row.id) : null,
      email: row.email ? String(row.email) : null,
      name: row.name ? String(row.name) : null,
      role,
      sessionId: row.session_id ? String(row.session_id) : null,
    }
  } catch {
    return null
  }
}

async function maybePurgeOldLogs() {
  const now = Date.now()
  if (now - lastPurgeAt < PURGE_INTERVAL_MS) return
  lastPurgeAt = now

  try {
    await db`
      DELETE FROM public.audit_logs
      WHERE created_at < (NOW() - make_interval(months => ${RETENTION_MONTHS}))
    `
  } catch (err) {
    console.error("[audit] failed to purge old logs", err)
  }
}

export async function writeAuditLog(input: AuditInput) {
  try {
    await ensureAuditSchema()

    const status = input.status ?? "success"
    const inferredActor = await inferActorFromRequest(input.req)
    const actorId = input.actor?.id ?? inferredActor?.id ?? null
    const actorEmail = input.actor?.email ?? inferredActor?.email ?? null
    const actorName = input.actor?.name ?? inferredActor?.name ?? null
    const actorRole = input.actor?.role ?? inferredActor?.role ?? null
    const sessionId = input.actor?.sessionId ?? inferredActor?.sessionId ?? null
    const targetType = input.target?.type ?? null
    const targetId =
      input.target?.id === null || input.target?.id === undefined
        ? null
        : String(input.target?.id)

    const requestMethod = input.req?.method ?? null
    const requestPath = input.req?.nextUrl?.pathname ?? null
    const ip = getIp(input.req)
    const userAgent = input.req?.headers.get("user-agent") ?? null

    const metadata = input.metadata ? sanitize(input.metadata) : null

    await db`
      INSERT INTO public.audit_logs (
        actor_id,
        actor_email,
        actor_name,
        actor_role,
        session_id,
        action,
        target_type,
        target_id,
        request_method,
        request_path,
        ip,
        user_agent,
        status,
        metadata
      )
      VALUES (
        ${actorId},
        ${actorEmail},
        ${actorName},
        ${actorRole},
        ${sessionId},
        ${input.action},
        ${targetType},
        ${targetId},
        ${requestMethod},
        ${requestPath},
        ${ip},
        ${userAgent},
        ${status},
        ${metadata}
      )
    `

    await maybePurgeOldLogs()
  } catch (err) {
    console.error("[audit] failed to write log", err)
  }
}
