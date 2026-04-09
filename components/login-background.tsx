"use client"

import React, { useMemo } from "react"
import { Atom, BookOpen, CircuitBoard, Cpu, GraduationCap, Lightbulb } from "lucide-react"

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function LoginBackgroundComponent() {
  const dots = useMemo(() => {
    return [...Array(26)].map((_, i) => ({
      size: round(1 + seededRandom(i + 10) * 2.2, 4),
      top: round(seededRandom(i + 20) * 100, 4),
      left: round(seededRandom(i + 30) * 100, 4),
      opacity: round(0.1 + seededRandom(i + 40) * 0.22, 6),
      blur: round(seededRandom(i + 50) * 2, 6),
      duration: round(5 + seededRandom(i + 60) * 6, 5),
      delay: round(seededRandom(i + 70) * 5, 5),
    }))
  }, [])

  const icons = useMemo(
    () => [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
    []
  )

  const iconPositions = useMemo(() => {
    return icons.map((_, i) => ({
      size: 44 + (i % 3) * 18,
      top: round(8 + seededRandom(i + 120) * 84, 4),
      left: round(8 + seededRandom(i + 180) * 84, 4),
      delay: round(i * 1.1, 4),
      duration: round(8 + (i % 4) * 2, 4),
      opacity: round(0.22 + (i % 3) * 0.08, 4),
    }))
  }, [icons])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
      <div className="absolute -top-24 left-1/3 h-[420px] w-[420px] rounded-full bg-cyan-400/12 blur-[160px] animate-[organicMove_18s_ease-in-out_infinite]" />
      <div className="absolute bottom-0 right-1/4 h-[360px] w-[360px] rounded-full bg-blue-400/12 blur-[150px] animate-[organicMove_20s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 -left-24 h-[300px] w-[300px] rounded-full bg-emerald-300/12 blur-[140px] animate-[organicMove_16s_ease-in-out_infinite]" />
      <div className="absolute top-16 right-16 h-[240px] w-[240px] rounded-full bg-sky-300/12 blur-[120px] animate-[organicMove_22s_ease-in-out_infinite]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.25),transparent_60%)] opacity-70" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent,rgba(255,255,255,0.04))] opacity-70" />
      <div className="absolute left-1/4 top-0 h-full w-24 bg-gradient-to-b from-cyan-400/20 via-transparent to-transparent blur-[18px] animate-[flow_18s_ease-in-out_infinite]" />
      <div className="absolute right-1/3 top-0 h-full w-20 bg-gradient-to-b from-blue-400/20 via-transparent to-transparent blur-[16px] animate-[flow_22s_ease-in-out_infinite]" />

      {icons.map((Icon, i) => (
        <div
          key={`icon-${i}`}
          className="absolute animate-[float_10s_ease-in-out_infinite]"
          style={{
            top: `${iconPositions[i].top}%`,
            left: `${iconPositions[i].left}%`,
            animationDelay: `${iconPositions[i].delay}s`,
            animationDuration: `${iconPositions[i].duration}s`,
          }}
        >
          <div
            className="absolute inset-0 -z-10 rounded-full bg-cyan-400/20 blur-[22px]"
            style={{
              width: iconPositions[i].size + 24,
              height: iconPositions[i].size + 24,
              transform: "translate(-12px, -12px)",
            }}
          />
          <Icon
            className="text-white/40 drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
            style={{
              width: iconPositions[i].size,
              height: iconPositions[i].size,
              opacity: iconPositions[i].opacity,
            }}
          />
        </div>
      ))}

      {dots.map((p, i) => (
        <div
          key={`dot-${i}`}
          className="absolute rounded-full bg-white/40 animate-twinkle"
          style={{
            width: p.size,
            height: p.size,
            top: `${p.top}%`,
            left: `${p.left}%`,
            opacity: p.opacity,
            filter: `blur(${p.blur}px)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export const LoginBackground = React.memo(LoginBackgroundComponent)
