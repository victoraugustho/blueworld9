"use client";

import React, { useMemo } from "react";
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
} from "lucide-react";

interface AnimatedBackgroundProps {
  variant?: "about" | "solutions" | "benefits" | "projects" | "impact" | "default";
}

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function AnimatedBackgroundComponent({ variant = "default" }: AnimatedBackgroundProps) {
  /* ÍCONES FIXOS POR VARIANTE */
  const icons = useMemo(() => {
    const iconMap = {
      about: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
      solutions: [Code, Cpu, Lightbulb, CircuitBoard, Zap, BookOpen],
      benefits: [GraduationCap, Target, Users, Atom, Lightbulb, BookOpen],
      projects: [CircuitBoard, Code, Cpu, Atom, Zap, Lightbulb],
      impact: [Users, GraduationCap, Target, BookOpen, Lightbulb, Atom],
      default: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
    };

    return iconMap[variant] || iconMap.default;
  }, [variant]);

  /* POSIÇÕES FIXAS PARA ÍCONES GRANDES */
  const iconPositions = useMemo(() => {
    return icons.map((_, i) => ({
      size: 40 + (i % 3) * 25,  
      top: 5 + seededRandom(i + 10) * 90,
      left: 5 + seededRandom(i + 20) * 90,
      delay: i * 0.8,
      opacity: 0.18 + (i % 3) * 0.07, 
    }));
  }, [icons]);

  /* PARTICLES LAYER 1 */
  const particles1 = useMemo(() => {
    return [...Array(40)].map((_, i) => ({
      size: 1 + seededRandom(i + 30) * 3,
      top: seededRandom(i + 40) * 100,
      left: seededRandom(i + 50) * 100,
      opacity: 0.2 + seededRandom(i + 60) * 0.4,
      blur: seededRandom(i + 70) * 2,
      duration: 2 + seededRandom(i + 80) * 3,
      delay: seededRandom(i + 90) * 3,
    }));
  }, []);

  /* PARTICLES LAYER 2 */
  const particles2 = useMemo(() => {
    return [...Array(40)].map((_, i) => ({
      size: 1 + seededRandom(i + 100) * 3,
      top: seededRandom(i + 110) * 100,
      left: seededRandom(i + 120) * 100,
      blur: 1 + seededRandom(i + 130) * 3,
      duration: 3 + seededRandom(i + 140) * 4,
    }));
  }, []);

  /* PARTICLES LAYER 3 */
  const particles3 = useMemo(() => {
    return [...Array(20)].map((_, i) => ({
      size: 2 + seededRandom(i + 200) * 4,
      top: seededRandom(i + 210) * 100,
      left: seededRandom(i + 220) * 100,
      blur: 2 + seededRandom(i + 230) * 5,
      duration: 4 + seededRandom(i + 240) * 5,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">

      {/* Background organic blobs (mantido igual) */}
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-cyan-400/15 rounded-full blur-[120px] animate-[organicMove_12s_ease-in-out_infinite]" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[140px] animate-[organicMove_14s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] bg-emerald-400/15 rounded-full blur-[110px] animate-[organicMove_10s_ease-in-out_infinite]" />

      {/* ÍCONES FLOATING FIXOS */}
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

      {/* PARTICLES LAYER 1 */}
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

      {/* PARTICLES LAYER 2 */}
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

      {/* PARTICLES LAYER 3 */}
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
  );
}

export const AnimatedBackground = React.memo(AnimatedBackgroundComponent);
