import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRestrictedAdminApi } from "@/lib/auth/restricted-admin-server"
import { writeAuditLog } from "@/lib/audit"
import { ensureRuntimeSchema } from "@/lib/runtime-schema"

type BugReportStatus = "pending" | "resolving" | "resolved"

async function ensureBugReportsStatusSchema() {
  await ensureRuntimeSchema("schema:bug_reports_status:v1", async () => {
    await db`
      ALTER TABLE public.bug_reports
      ADD COLUMN IF NOT EXISTS status TEXT
    `

    await db`
      UPDATE public.bug_reports
      SET status = 'pending'
      WHERE status IS NULL
    `

    await db`
      ALTER TABLE public.bug_reports
      ALTER COLUMN status SET DEFAULT 'pending'
    `

    await db`
      ALTER TABLE public.bug_reports
      ALTER COLUMN status SET NOT NULL
    `

    await db`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'bug_reports_status_check'
        ) THEN
          ALTER TABLE public.bug_reports
            ADD CONSTRAINT bug_reports_status_check
            CHECK (status IN ('pending', 'resolving', 'resolved'));
        END IF;
      END
      $$;
    `
  })
}

function normalizeStatus(value: unknown): BugReportStatus | null {
  if (value === "pending" || value === "resolving" || value === "resolved") {
    return value
  }
  return null
}

export async function GET(req: NextRequest) {
  const auth = await requireRestrictedAdminApi()
  if (!auth.ok) return auth.response

  const searchParams = new URL(req.url).searchParams
  const summaryOnly = searchParams.get("summary") === "1"
  const [statusColumn] = await db`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bug_reports'
      AND column_name = 'status'
    LIMIT 1
  `
  const hasStatus = !!statusColumn

  if (summaryOnly) {
    const [summary] = hasStatus
      ? await db`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'resolving')::int AS resolving,
            COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'resolved')::int AS resolved
          FROM bug_reports
        `
      : await db`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*)::int AS pending,
            0::int AS resolving,
            0::int AS resolved
          FROM bug_reports
        `

    return NextResponse.json({
      total: Number(summary?.total ?? 0),
      pending: Number(summary?.pending ?? 0),
      resolving: Number(summary?.resolving ?? 0),
      resolved: Number(summary?.resolved ?? 0),
    })
  }

  const rows = hasStatus
    ? await db`
        SELECT
          r.*,
          COALESCE(r.status, 'pending') AS status,
          t.name AS teacher_name,
          t.email AS teacher_email
        FROM bug_reports r
        JOIN teachers t ON t.id = r.teacher_id
        ORDER BY
          CASE COALESCE(r.status, 'pending')
            WHEN 'pending' THEN 1
            WHEN 'resolving' THEN 2
            ELSE 3
          END ASC,
          r.created_at DESC
      `
    : await db`
        SELECT
          r.*,
          'pending'::text AS status,
          t.name AS teacher_name,
          t.email AS teacher_email
        FROM bug_reports r
        JOIN teachers t ON t.id = r.teacher_id
        ORDER BY r.created_at DESC
      `

  return NextResponse.json(rows)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRestrictedAdminApi()
  if (!auth.ok) return auth.response
  await ensureBugReportsStatusSchema()

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? "").trim()
  const status = normalizeStatus(body.status)

  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 })
  }

  if (!status) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 })
  }

  const [updated] = await db`
    UPDATE bug_reports
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, status
  `

  if (!updated) {
    return NextResponse.json({ error: "Relacao nao encontrada" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: "admin.bug_reports.status.update",
    status: "success",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "admin",
      sessionId: auth.sessionId,
    },
    target: { type: "bug_report", id },
    metadata: { status },
  })

  return NextResponse.json({ success: true, id: updated.id, status: updated.status })
}

