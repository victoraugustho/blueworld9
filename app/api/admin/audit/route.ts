import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { ensureAuditSchema } from "@/lib/audit-schema"

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

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

  const limit = Math.min(100, Math.max(1, toInt(searchParams.get("limit"), 50)))
  const offset = toInt(searchParams.get("offset"), 0)

  const filters: any[] = []

  if (status && status !== "all") {
    filters.push(db`status = ${status}`)
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

  const where =
    filters.length > 0
      ? db`WHERE ${filters.reduce((acc, cur, idx) => (idx === 0 ? cur : db`${acc} AND ${cur}`))}`
      : db``

  const [countRow] = await db`
    SELECT COUNT(*)::int AS count
    FROM public.audit_logs
    ${where}
  `

  const rows = await db`
    SELECT *
    FROM public.audit_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return NextResponse.json({ total: countRow?.count ?? 0, items: rows })
}
