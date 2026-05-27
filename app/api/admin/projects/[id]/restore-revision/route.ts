import { NextRequest, NextResponse } from "next/server"
import { writeAuditLog } from "@/lib/audit"
import { requireProjectAdminApi } from "@/lib/auth/project-admin-server"
import { ensureProjectsSchema, isUuid } from "@/lib/projects"
import { applyProjectSnapshotFromRevision, loadProjectFull } from "@/lib/project-service"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireProjectAdminApi()
  if (!auth.ok) return auth.response

  await ensureProjectsSchema()

  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const revisionId = String(body.revision_id ?? "").trim()
  if (!isUuid(revisionId)) return NextResponse.json({ error: "revision_id inválido." }, { status: 400 })

  const restored = await applyProjectSnapshotFromRevision(id, revisionId, auth.teacherId)
  if (!restored.ok) {
    return NextResponse.json({ error: restored.error }, { status: 404 })
  }

  const full = await loadProjectFull(id)

  await writeAuditLog({
    req,
    action: "admin.projects.restore_revision",
    status: "success",
    actor: { id: auth.teacherId, email: auth.teacher.email, role: "admin", sessionId: auth.sessionId },
    target: { type: "project", id },
    metadata: {
      revision_id: revisionId,
      revision_number: restored.revision_number,
    },
  })

  return NextResponse.json({ success: true, project: full })
}

