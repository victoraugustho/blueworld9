import type React from "react"
import { AOSInit } from "@/components/AOSInit"
import { AnimatedBackground } from "@/components/animated-background"
import { requireTeacherPage } from "@/lib/auth/server"
import { SessionExpiryGuard } from "@/components/auth/SessionExpiryGuard"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacherPage()
  const sessionExpiresAt = new Date(teacher.session_expires_at).toISOString()

  return (
    <div className="relative min-h-screen  bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AnimatedBackground />
      <AOSInit />
      <SessionExpiryGuard expiresAt={sessionExpiresAt} locale={teacher.locale} country={teacher.country} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
