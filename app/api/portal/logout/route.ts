import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { clearSessionCookie, revokeSessionByToken } from "@/lib/auth/session";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) {
    await revokeSessionByToken(token)
  }

  const response = NextResponse.redirect(process.env.NEXT_PUBLIC_SITE_URL + "/portal/login")
  clearSessionCookie(response)

  return response
}
