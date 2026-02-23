import type React from "react"
import { AOSInit } from "@/components/AOSInit"
import { GlassmorphismNav } from "@/components/header"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[180px]" />
        <div className="absolute top-1/3 -right-20 h-[480px] w-[480px] rounded-full bg-purple-500/10 blur-[180px]" />
        <div className="absolute -bottom-40 left-0 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[180px]" />
      </div>
      <GlassmorphismNav />
      <AOSInit />
      {children}
    </div>
  );
}
