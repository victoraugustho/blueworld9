import type React from "react"
import { AOSInit } from "@/components/AOSInit"
import { AnimatedBackground } from "@/components/animated-background"
import { GlassmorphismNav } from "@/components/header"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell relative min-h-screen overflow-x-hidden">
      <AnimatedBackground fixed parallax />
      <GlassmorphismNav />
      <AOSInit />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
