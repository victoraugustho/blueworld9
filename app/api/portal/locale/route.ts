import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth/require"
import { PORTAL_LOCALE_COOKIE, normalizePortalLocale } from "@/lib/portal-locale"

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const locale = normalizePortalLocale(body?.locale)

  const response = NextResponse.json({ success: true, locale })
  response.cookies.set(PORTAL_LOCALE_COOKIE, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}
