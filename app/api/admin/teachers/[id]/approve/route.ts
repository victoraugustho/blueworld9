import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminApi } from "@/lib/auth/require"
import { writeAuditLog } from "@/lib/audit"
import {
  normalizeTeacherPortalPermissions,
  TEACHER_PORTAL_PERMISSION_KEYS,
} from "@/lib/auth/teacher-permissions"
import {
  normalizeTeacherContentPermissions,
  TEACHER_CONTENT_AREAS,
} from "@/lib/auth/teacher-content-permissions"

type Ctx = { params: Promise<{ id: string }> } // ✅ params como Promise (Next 16 sync-dynamic-apis)

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params

  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await req.json().catch(() => ({}))
  const hasExplicitPermissions = body.portal_permissions
    && typeof body.portal_permissions === "object"
    && !Array.isArray(body.portal_permissions)
    && TEACHER_PORTAL_PERMISSION_KEYS.every(
      (permission) => typeof body.portal_permissions[permission] === "boolean",
    )
  const hasExplicitContentPermissions = body.content_permissions
    && typeof body.content_permissions === "object"
    && !Array.isArray(body.content_permissions)
    && TEACHER_CONTENT_AREAS.every((area) => {
      const scope = body.content_permissions[area]
      return scope
        && typeof scope === "object"
        && !Array.isArray(scope)
        && (scope.mode === "inherit" || scope.mode === "specific")
        && Array.isArray(scope.category_ids)
        && Array.isArray(scope.item_ids)
    })

  if (
    (body.decision !== "approve" && body.decision !== "reject")
    || typeof body.can_download !== "boolean"
    || !hasExplicitPermissions
    || !hasExplicitContentPermissions
  ) {
    return NextResponse.json(
      { error: "Informe explicitamente a decisão e todas as permissões do professor." },
      { status: 400 },
    )
  }

  const decision = body.decision as "approve" | "reject"
  const canDownload = body.can_download
  const portalPermissions = normalizeTeacherPortalPermissions(body.portal_permissions)
  const contentPermissions = normalizeTeacherContentPermissions(body.content_permissions)

  const [schema] = await db`
    SELECT COUNT(*)::int = 3 AS ready
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teachers'
      AND column_name IN ('can_download', 'portal_permissions', 'content_permissions')
  `

  if (schema?.ready !== true) {
    return NextResponse.json(
      { error: "A estrutura de permissões ainda não foi instalada. Execute a migração 045 antes de decidir o cadastro." },
      { status: 409 },
    )
  }

  const approved = decision === "approve"
  const active = decision === "approve"

  const [result] = await db`
    UPDATE public.teachers
    SET approved = ${approved},
        active = ${active},
        can_download = ${canDownload},
        portal_permissions = ${JSON.stringify(portalPermissions)}::jsonb,
        content_permissions = ${JSON.stringify(contentPermissions)}::jsonb,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id, name, email, phone,
      country, locale, document_type, document_number,
      approved, active, can_download, portal_permissions, content_permissions,
      created_at, updated_at
  `

  if (!result) {
    return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 })
  }

  await writeAuditLog({
    req,
    action: decision === "approve" ? "admin.teachers.approve" : "admin.teachers.reject",
    status: "success",
    actor: { id: admin.teacherId, email: admin.teacher.email, role: "admin", sessionId: admin.sessionId },
    target: { type: "teacher", id },
    metadata: {
      decision,
      can_download: canDownload,
      portal_permissions: portalPermissions,
      content_permissions: contentPermissions,
    },
  })

  return NextResponse.json(result)
}
