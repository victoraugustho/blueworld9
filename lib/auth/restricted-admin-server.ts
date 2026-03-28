import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { requireAdminApi } from "@/lib/auth/require"
import { requireAdminPage } from "@/lib/auth/server"
import { isRestrictedAdminUser } from "@/lib/auth/restricted-admin"

export async function requireRestrictedAdminPage() {
  const teacher = await requireAdminPage()
  if (!isRestrictedAdminUser(teacher.id)) {
    redirect("/portal/dashboard")
  }
  return teacher
}

export async function requireRestrictedAdminApi() {
  const auth = await requireAdminApi()
  if (!auth.ok) return auth

  if (!isRestrictedAdminUser(auth.teacherId)) {
    return { ok: false as const, response: NextResponse.json({ error: "Sem permissao" }, { status: 403 }) }
  }

  return auth
}
