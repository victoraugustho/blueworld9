import type React from "react"
import { AOSInit } from "@/components/AOSInit"
import { AnimatedBackground } from "@/components/animated-background"


export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen  bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AnimatedBackground />
      <AOSInit />
      {children}
    </div>
  );
}
