"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  fixed?: boolean;
  parallax?: boolean;
}

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function useAnimationPrefs() {
  const [state, setState] = useState({ enabled: false, isMobile: false });

  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 768px)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      const saveData = (navigator as any)?.connection?.saveData === true;
      const isMobile = mqMobile.matches;
      setState({ enabled: !isMobile && !mqReduce.matches && !saveData, isMobile });
    };

    update();

    const onChange = () => update();
    mqMobile.addEventListener("change", onChange);
    mqReduce.addEventListener("change", onChange);

    return () => {
      mqMobile.removeEventListener("change", onChange);
      mqReduce.removeEventListener("change", onChange);
    };
  }, []);

  return state;
}

function AnimatedBackgroundComponent({
  variant = "default",
  fixed = false,
  parallax = false,
}: AnimatedBackgroundProps) {
  const { enabled, isMobile } = useAnimationPrefs();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !parallax) return;
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      const y = window.scrollY || 0;
      el.style.setProperty("--parallax-y", `${Math.round(y * 0.08)}px`);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, parallax]);

  const containerClass = `${fixed ? "fixed" : "absolute"} inset-0 pointer-events-none overflow-hidden z-0 animated-bg`;
  const containerStyle: React.CSSProperties | undefined = parallax
    ? { transform: "translate3d(0,var(--parallax-y,0),0)", willChange: "transform" }
    : undefined;

  const icons = useMemo(() => {
    if (!enabled) return [];
    const iconMap = {
      about: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
      solutions: [Code, Cpu, Lightbulb, CircuitBoard, Zap, BookOpen],
      benefits: [GraduationCap, Target, Users, Atom, Lightbulb, BookOpen],
      projects: [CircuitBoard, Code, Cpu, Atom, Zap, Lightbulb],
      impact: [Users, GraduationCap, Target, BookOpen, Lightbulb, Atom],
      default: [BookOpen, Cpu, Lightbulb, Atom, GraduationCap, CircuitBoard],
    } as const;

    return iconMap[variant] || iconMap.default;
  }, [variant, enabled]);

  const iconPositions = useMemo(() => {
    if (!enabled) return [];
    return icons.map((_, i) => ({
      size: 40 + (i % 3) * 25,
      top: 5 + seededRandom(i + 10) * 90,
      left: 5 + seededRandom(i + 20) * 90,
      delay: i * 0.8,
      opacity: 0.18 + (i % 3) * 0.07,
    }));
  }, [icons, enabled]);

  const particles1 = useMemo(() => {
    if (!enabled) return [];
    return [...Array(40)].map((_, i) => ({
      size: 1 + seededRandom(i + 30) * 3,
      top: seededRandom(i + 40) * 100,
      left: seededRandom(i + 50) * 100,
      opacity: 0.2 + seededRandom(i + 60) * 0.4,
      blur: seededRandom(i + 70) * 2,
      duration: 2 + seededRandom(i + 80) * 3,
      delay: seededRandom(i + 90) * 3,
    }));
  }, [enabled]);

  const particles2 = useMemo(() => {
    if (!enabled) return [];
    return [...Array(40)].map((_, i) => ({
      size: 1 + seededRandom(i + 100) * 3,
      top: seededRandom(i + 110) * 100,
      left: seededRandom(i + 120) * 100,
      blur: 1 + seededRandom(i + 130) * 3,
      duration: 3 + seededRandom(i + 140) * 4,
    }));
  }, [enabled]);

  const particles3 = useMemo(() => {
    if (!enabled) return [];
    return [...Array(20)].map((_, i) => ({
      size: 2 + seededRandom(i + 200) * 4,
      top: seededRandom(i + 210) * 100,
      left: seededRandom(i + 220) * 100,
      blur: 2 + seededRandom(i + 230) * 5,
      duration: 4 + seededRandom(i + 240) * 5,
    }));
  }, [enabled]);

  if (isMobile) {
    return null;
  }

  if (!enabled) {
    return (
      <div ref={containerRef} className={containerClass} style={containerStyle}>
        <div className="absolute top-16 left-1/3 w-72 h-72 bg-cyan-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-6 w-80 h-80 bg-purple-500/10 rounded-full blur-[140px]" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={containerClass} style={containerStyle}>
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
  );
}

export const AnimatedBackground = React.memo(AnimatedBackgroundComponent);
