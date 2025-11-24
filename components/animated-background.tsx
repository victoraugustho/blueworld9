"use client"

import { BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard, Zap, Code, Users, Target } from "lucide-react"

interface AnimatedBackgroundProps {
  variant?: "about" | "solutions" | "benefits" | "projects" | "impact" | "default"
}

export function AnimatedBackground({ variant = "default" }: AnimatedBackgroundProps) {
  const random_number = 1 + Math.random()

  const getIcons = () => {
    const iconMap = {
      about: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
      solutions: [Code, Cpu, Lightbulb, CircuitBoard, Zap, BookOpen],
      benefits: [GraduationCap, Target, Users, Atom, Lightbulb, BookOpen],
      projects: [CircuitBoard, Code, Cpu, Atom, Zap, Lightbulb],
      impact: [Users, GraduationCap, Target, BookOpen, Lightbulb, Atom],
      default: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
    }
    return iconMap[variant] || iconMap.default
  }

  const icons = getIcons()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {/* Organic moving blobs */}
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-cyan-400/15 rounded-full blur-[120px] animate-[organicMove_12s_ease-in-out_infinite]" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[140px] animate-[organicMove_14s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] bg-emerald-400/15 rounded-full blur-[110px] animate-[organicMove_10s_ease-in-out_infinite]" />

      {/* Animated icons */}
      {icons.map((Icon, i) => (
        <Icon
          key={`icon-${i}`}
          className="absolute text-white/25 animate-[float_8s_ease-in-out_infinite]"
          style={{
            width: `${20 + (i % 3) * 8}px`,
            height: `${20 + (i % 3) * 8}px`,
            top: `${Math.random() * 80 + 10}%`,
            left: `${Math.random() * 80 + 10}%`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}

      {/* Twinkling particles - Layer 1 */}
      {[...Array(40)].map((_, i) => (
        <div
          key={`p1-${i}`}
          className="absolute bg-white/50 rounded-full animate-twinkle"
          style={{
            width: `${random_number * 3}px`,
            height: `${random_number * 3}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: 0.2 + Math.random() * 0.4,
            filter: `blur(${Math.random() * 2}px)`,
            animationDuration: `${2 + Math.random() * 3}s`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}

      {/* Twinkling particles - Layer 2 */}
      {[...Array(40)].map((_, i) => (
        <div
          key={`p2-${i}`}
          className="absolute bg-cyan-200/30 rounded-full animate-twinkle"
          style={{
            width: `${1 + Math.random() * 3}px`,
            height: `${1 + Math.random() * 3}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            filter: `blur(${1 + Math.random() * 3}px)`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }}
        />
      ))}

      {/* Twinkling particles - Layer 3 */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`p3-${i}`}
          className="absolute bg-purple-300/30 rounded-full animate-twinkle"
          style={{
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            filter: `blur(${2 + Math.random() * 5}px)`,
            animationDuration: `${4 + Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  )
}
