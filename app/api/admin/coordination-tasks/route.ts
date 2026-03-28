import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import { ensureCoordinationTasksSchema } from "@/lib/coordination"

type TaskStatus = "todo" | "doing" | "done"
type TaskPriority = "low" | "medium" | "high"

function parseStatus(value: string): TaskStatus | null {
  if (value === "todo" || value === "doing" || value === "done") return value
  return null
}

function parsePriority(value: string): TaskPriority | null {
  if (value === "low" || value === "medium" || value === "high") return value
  return null
}

function normalizeDueDate(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  return raw
}

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationTasksSchema()

  const rows = await db`
    SELECT
      id,
      title,
      description,
      status,
      priority,
      due_date,
      created_at,
      updated_at
    FROM coordination_tasks
    ORDER BY
      CASE status
        WHEN 'todo' THEN 1
        WHEN 'doing' THEN 2
        ELSE 3
      END,
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      due_date ASC NULLS LAST,
      created_at DESC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationTasksSchema()

  const body = await req.json()
  const title = String(body.title ?? "").trim()
  const description = String(body.description ?? "").trim() || null
  const status = parseStatus(String(body.status ?? "todo").trim())
  const priority = parsePriority(String(body.priority ?? "medium").trim())
  const dueDate = normalizeDueDate(body.due_date)

  if (!title) {
    return NextResponse.json({ error: "Titulo obrigatorio" }, { status: 400 })
  }

  if (!status) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 })
  }

  if (!priority) {
    return NextResponse.json({ error: "Prioridade invalida" }, { status: 400 })
  }

  if (dueDate === undefined) {
    return NextResponse.json({ error: "Data limite invalida" }, { status: 400 })
  }

  const [created] = await db`
    INSERT INTO coordination_tasks (
      title,
      description,
      status,
      priority,
      due_date,
      created_by,
      updated_by
    )
    VALUES (
      ${title},
      ${description},
      ${status},
      ${priority},
      ${dueDate},
      ${admin.teacherId},
      ${admin.teacherId}
    )
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "admin.coordination_tasks.create",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_task", id: created?.id },
    metadata: { title, status, priority, due_date: dueDate },
  })

  return NextResponse.json(created)
}
