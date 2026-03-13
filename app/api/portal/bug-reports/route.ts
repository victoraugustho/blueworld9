import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTeacherApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const auth = await requireTeacherApi()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? "").trim()
  const description = String(body.description ?? "").trim()
  const pageUrlRaw = String(body.page_url ?? "").trim()
  const page_url = pageUrlRaw ? pageUrlRaw : null
  const user_agent = req.headers.get("user-agent") ?? null

  if (!title) {
    return NextResponse.json({ error: "Titulo obrigatorio" }, { status: 400 })
  }

  if (!description) {
    return NextResponse.json({ error: "Descricao obrigatoria" }, { status: 400 })
  }

  const [row] = await db`
    INSERT INTO bug_reports (teacher_id, title, description, page_url, user_agent)
    VALUES (${auth.teacherId}, ${title}, ${description}, ${page_url}, ${user_agent})
    RETURNING *
  `

  await writeAuditLog({
    req,
    action: "teacher.bug_reports.create",
    actor: {
      id: auth.teacherId,
      email: auth.teacher.email,
      name: auth.teacher.name,
      role: auth.teacher.role ?? "teacher",
      sessionId: auth.sessionId,
    },
    target: { type: "bug_report", id: row?.id },
    metadata: {
      has_page_url: Boolean(page_url),
    },
  })

  return NextResponse.json(row)
}
