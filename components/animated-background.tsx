import {
  BookOpen,
  Cpu,
  Lightbulb,
  Atom,
  GraduationCap,
  CircuitBoard,
  Zap,
  Code,
  Users,
  Target,
} from "lucide-react"

interface AnimatedBackgroundProps {
  variant?: "about" | "solutions" | "benefits" | "projects" | "impact" | "default"
}

type Particle = {
  size: number
  top: number
  left: number
  opacity?: number
  blur: number
  duration: number
  delay?: number
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getIcons(variant: AnimatedBackgroundProps["variant"]) {
  const iconMap = {
    about: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
    solutions: [Code, Cpu, Lightbulb, CircuitBoard, Zap, BookOpen],
    benefits: [GraduationCap, Target, Users, Atom, Lightbulb, BookOpen],
    projects: [CircuitBoard, Code, Cpu, Atom, Zap, Lightbulb],
    impact: [Users, GraduationCap, Target, BookOpen, Lightbulb, Atom],
    default: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
  }

  return iconMap[variant ?? "default"] ?? iconMap.default
}

function createParticles(offset: number, amount: number, config: "one" | "two" | "three") {
  return Array.from({ length: amount }).map((_, i): Particle => {
    if (config === "one") {
      return {
        size: 1 + seededRandom(i + 30 + offset) * 3,
        top: seededRandom(i + 40 + offset) * 100,
        left: seededRandom(i + 50 + offset) * 100,
        opacity: 0.2 + seededRandom(i + 60 + offset) * 0.4,
        blur: seededRandom(i + 70 + offset) * 2,
        duration: 2 + seededRandom(i + 80 + offset) * 3,
        delay: seededRandom(i + 90 + offset) * 3,
      }
    }

    if (config === "two") {
      return {
        size: 1 + seededRandom(i + 100 + offset) * 3,
        top: seededRandom(i + 110 + offset) * 100,
        left: seededRandom(i + 120 + offset) * 100,
        blur: 1 + seededRandom(i + 130 + offset) * 3,
        duration: 3 + seededRandom(i + 140 + offset) * 4,
      }
    }

    return {
      size: 2 + seededRandom(i + 200 + offset) * 4,
      top: seededRandom(i + 210 + offset) * 100,
      left: seededRandom(i + 220 + offset) * 100,
      blur: 2 + seededRandom(i + 230 + offset) * 5,
      duration: 4 + seededRandom(i + 240 + offset) * 5,
    }
  })
}

export function AnimatedBackground({ variant = "default" }: AnimatedBackgroundProps) {
  const icons = getIcons(variant)

  const iconPositions = icons.map((_, i) => ({
    size: 40 + (i % 3) * 25,
    top: 5 + seededRandom(i + 10) * 90,
    left: 5 + seededRandom(i + 20) * 90,
    delay: i * 0.8,
  }))

  const particles1 = createParticles(0, 40, "one")
  const particles2 = createParticles(0, 40, "two")
  const particles3 = createParticles(0, 20, "three")

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-cyan-400/15 rounded-full blur-[120px] animate-[organicMove_12s_ease-in-out_infinite]" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[140px] animate-[organicMove_14s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] bg-emerald-400/15 rounded-full blur-[110px] animate-[organicMove_10s_ease-in-out_infinite]" />

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
