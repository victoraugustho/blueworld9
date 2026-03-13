import type React from "react"
import { AOSInit } from "@/components/AOSInit"
import { AnimatedBackground } from "@/components/animated-background"
import { requireTeacherPage } from "@/lib/auth/server"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireTeacherPage()

  return (
    <div className="relative min-h-screen  bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AnimatedBackground />
      <AOSInit />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
