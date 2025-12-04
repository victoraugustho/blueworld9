"use client"

import {
  BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard,
  Zap, Code, Users, Target
} from "lucide-react"
import { useMemo } from "react"

interface AnimatedBackgroundProps {
  variant?: "about" | "solutions" | "benefits" | "projects" | "impact" | "default"
}

export function AnimatedBackground({ variant = "default" }: AnimatedBackgroundProps) {

  // evita recalcular random a cada tecla
  const icons = useMemo(() => {
    const iconMap = {
      about: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
      solutions: [Code, Cpu, Lightbulb, CircuitBoard, Zap, BookOpen],
      benefits: [GraduationCap, Target, Users, Atom, Lightbulb, BookOpen],
      projects: [CircuitBoard, Code, Cpu, Atom, Zap, Lightbulb],
      impact: [Users, GraduationCap, Target, BookOpen, Lightbulb, Atom],
      default: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
    }
    return iconMap[variant] || iconMap.default
  }, [variant])

  // gera posições fixas apenas 1 vez
  const iconPositions = useMemo(() => {
    return icons.map((_, i) => ({
      size: 20 + (i % 3) * 8,
      top: Math.random() * 80 + 10,
      left: Math.random() * 80 + 10,
      delay: i * 0.5,
    }))
  }, [icons])

  const particles1 = useMemo(() => (
    [...Array(40)].map(() => ({
      size: 1 + Math.random() * 3,
      top: Math.random() * 100,
      left: Math.random() * 100,
      opacity: 0.2 + Math.random() * 0.4,
      blur: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 3,
    }))
  ), [])

  const particles2 = useMemo(() => (
    [...Array(40)].map(() => ({
      size: 1 + Math.random() * 3,
      top: Math.random() * 100,
      left: Math.random() * 100,
      blur: 1 + Math.random() * 3,
      duration: 3 + Math.random() * 4,
    }))
  ), [])

  const particles3 = useMemo(() => (
    [...Array(20)].map(() => ({
      size: 2 + Math.random() * 4,
      top: Math.random() * 100,
      left: Math.random() * 100,
      blur: 2 + Math.random() * 5,
      duration: 4 + Math.random() * 5,
    }))
  ), [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">

      {/* Organic blobs */}
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-cyan-400/15 rounded-full blur-[120px] animate-[organicMove_12s_ease-in-out_infinite]" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[140px] animate-[organicMove_14s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] bg-emerald-400/15 rounded-full blur-[110px] animate-[organicMove_10s_ease-in-out_infinite]" />

      {/* FIXED ICONS */}
      {icons.map((Icon, i) => (
        <Icon
          key={i}
          className="absolute text-white/25 animate-[float_8s_ease-in-out_infinite]"
          style={{
            width: iconPositions[i].size,
            height: iconPositions[i].size,
            top: `${iconPositions[i].top}%`,
            left: `${iconPositions[i].left}%`,
            animationDelay: `${iconPositions[i].delay}s`,
          }}
        />
      ))}

      {/* PARTICLES: Layer 1 */}
      {particles1.map((p, i) => (
        <div
          key={`p1-${i}`}
          className="absolute bg-white/50 rounded-full animate-twinkle"
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

      {/* PARTICLES: Layer 2 */}
      {particles2.map((p, i) => (
        <div
          key={`p2-${i}`}
          className="absolute bg-cyan-200/30 rounded-full animate-twinkle"
          style={{
            width: p.size,
            height: p.size,
            top: `${p.top}%`,
            left: `${p.left}%`,
            filter: `blur(${p.blur}px)`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* PARTICLES: Layer 3 */}
      {particles3.map((p, i) => (
        <div
          key={`p3-${i}`}
          className="absolute bg-purple-300/30 rounded-full animate-twinkle"
          style={{
            width: p.size,
            height: p.size,
            top: `${p.top}%`,
            left: `${p.left}%`,
            filter: `blur(${p.blur}px)`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
