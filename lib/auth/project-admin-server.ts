import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { requireAdminApi } from "@/lib/auth/require"
import { requireAdminPage } from "@/lib/auth/server"
import { canManageProjects } from "@/lib/auth/project-admin"

export async function requireProjectAdminPage() {
  const teacher = await requireAdminPage()
  if (!canManageProjects(teacher.id)) {
    redirect("/portal/dashboard")
  }
  return teacher
}

export async function requireProjectAdminApi() {
  const auth = await requireAdminApi()
  if (!auth.ok) return auth

  if (!canManageProjects(auth.teacherId)) {
    return { ok: false as const, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  }

  return auth
}

