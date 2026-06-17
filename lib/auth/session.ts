import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { db } from "@/lib/db"
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/constants"

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export function hashSessionToken(token: string) {
  return sha256(token)
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 })
}

export async function createSession(teacherId: string, req: NextRequest) {
  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  const userAgent = req.headers.get("user-agent") ?? null

  await db`
    INSERT INTO teacher_sessions (teacher_id, token_hash, expires_at, ip, user_agent)
    VALUES (${teacherId}, ${tokenHash}, ${expiresAt}, ${ip}, ${userAgent})
  `

  return { token, expiresAt }
}

export async function revokeSessionByToken(token: string) {
  if (!token) return
  const tokenHash = sha256(token)
  await db`
    UPDATE teacher_sessions
    SET revoked_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
  `
}

export async function revokeSessionsForTeacher(teacherId: string) {
  await db`
    UPDATE teacher_sessions
    SET revoked_at = NOW()
    WHERE teacher_id = ${teacherId}
      AND revoked_at IS NULL
  `
}
