import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

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

async function ensureCoordinationTasksTable() {
  await db`
    CREATE TABLE IF NOT EXISTS public.coordination_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      due_date DATE,
      created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db`
    CREATE INDEX IF NOT EXISTS coordination_tasks_status_idx
    ON public.coordination_tasks(status)
  `

  await db`
    CREATE INDEX IF NOT EXISTS coordination_tasks_due_date_idx
    ON public.coordination_tasks(due_date)
  `
}

async function findTask(id: string) {
  const [row] = await db`
    SELECT id
    FROM coordination_tasks
    WHERE id = ${id}
    LIMIT 1
  `
  return row
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationTasksTable()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const existing = await findTask(id)
  if (!existing) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

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

  const [updated] = await db`
    UPDATE coordination_tasks
    SET title = ${title},
        description = ${description},
        status = ${status},
        priority = ${priority},
        due_date = ${dueDate},
        updated_by = ${admin.teacherId},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "admin.coordination_tasks.update",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_task", id },
    metadata: { title, status, priority, due_date: dueDate },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  await ensureCoordinationTasksTable()

  const { id: rawId } = await params
  const id = String(rawId ?? "").trim()
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 })

  const existing = await findTask(id)
  if (!existing) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  await db`
    DELETE FROM coordination_tasks
    WHERE id = ${id}
  `

  await writeAuditLog({
    req,
    action: "admin.coordination_tasks.delete",
    actor: {
      id: admin.teacherId,
      email: admin.teacher.email,
      name: admin.teacher.name,
      role: "admin",
      sessionId: admin.sessionId,
    },
    target: { type: "coordination_task", id },
  })

  return NextResponse.json({ ok: true })
}
