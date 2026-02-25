import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@/lib/auth/constants"
import { clearSessionCookie, revokeSessionByToken } from "@/lib/auth/session"
import { getTeacherFromSession } from "@/lib/auth/server"
import { writeAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest) {
  const teacher = await getTeacherFromSession()
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) {
    await revokeSessionByToken(token)
  }

  await writeAuditLog({
    req: request,
    action: "auth.logout",
    status: "success",
    actor: teacher
      ? { id: teacher.id, email: teacher.email, role: teacher.is_admin ? "admin" : "teacher" }
      : { role: "guest" },
  })

  const response = NextResponse.redirect(process.env.NEXT_PUBLIC_SITE_URL + "/")
  clearSessionCookie(response)

  return response
}
