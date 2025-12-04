"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { BookOpen, Cpu, Lightbulb, Atom, GraduationCap } from "lucide-react"
import Image from "next/image"

export function HeroSection() {
  const [counts, setCounts] = useState({
    schools: 0,
    students: 0,
    projects: 0,
  })

  // 🔢 CONTADORES COM ANIMAÇÃO SUAVE
  useEffect(() => {
    const duration = 2000
    const steps = 60
    const interval = duration / steps

    const targets = {
      schools: 20,
      students: 15000,
      projects: 100,
    }

    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = step / steps

      setCounts({
        schools: Math.floor(targets.schools * progress),
        students: Math.floor(targets.students * progress),
        projects: Math.floor(targets.projects * progress),
      })

      if (step >= steps) {
        clearInterval(timer)
        setCounts(targets)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [])

  // 🎯 Botão scroll
  const scrollToContact = () => {
    const element = document.getElementById("contato")
    if (element) element.scrollIntoView({ behavior: "smooth" })
  }

  // 🌟 PARTICULAS FIXAS (sem bug)
  const [particles1, setParticles1] = useState<any[]>([])
  const [particles2, setParticles2] = useState<any[]>([])
  const [particles3, setParticles3] = useState<any[]>([])

  useEffect(() => {
    // CAMADA 1 — Brancas
    const p1 = Array.from({ length: 80 }).map(() => ({
      size: 1 + Math.random() * 4,
      top: Math.random() * 100,
      left: Math.random() * 100,
      opacity: 0.2 + Math.random() * 0.6,
      blur: Math.random() * 3,
      duration: 2 + Math.random() * 4,
      delay: Math.random() * 4,
    }))

    // CAMADA 2 — Cyan
    const p2 = Array.from({ length: 60 }).map(() => ({
      size: 1 + Math.random() * 4,
      top: Math.random() * 100,
      left: Math.random() * 100,
      blur: 1 + Math.random() * 4,
      duration: 3 + Math.random() * 5,
    }))

    // CAMADA 3 — Roxas
    const p3 = Array.from({ length: 40 }).map(() => ({
      size: 2 + Math.random() * 5,
      top: Math.random() * 100,
      left: Math.random() * 100,
      blur: 2 + Math.random() * 6,
      duration: 4 + Math.random() * 6,
    }))

    setParticles1(p1)
    setParticles2(p2)
    setParticles3(p3)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-32 pb-20">

      {/* 🔵 BACKGROUND IMAGE */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/webp/bg-v5.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>


      {/* 🔮 FUNDO CINEMATOGRÁFICO */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">

        {/* 🧬 FIOS DE LUZ */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[2px] h-full bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent animate-[flow_8s_linear_infinite]"
            style={{
              left: `${5 + i * 12}%`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}

        {/* 🔵 BOLHAS ORGÂNICAS */}
        <div className="absolute top-20 left-1/3 w-96 h-96 bg-cyan-400/20 rounded-full blur-[120px] animate-[organicMove_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[140px] animate-[organicMove_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 -left-20 w-[400px] h-[400px] bg-emerald-400/20 rounded-full blur-[110px] animate-[organicMove_10s_ease-in-out_infinite]" />

        {/* 📘 ÍCONES LUCIDE ANIMADOS */}
        <BookOpen className="absolute top-32 left-12 w-20 h-20 text-white/30 animate-[float_7s_ease-in-out_infinite]" />
        <Cpu className="absolute bottom-40 right-24 w-24 h-24 text-cyan-300/40 animate-[float_9s_ease-in-out_infinite]" />
        <Lightbulb className="absolute top-1/4 right-14 w-20 h-20 text-yellow-300/40 animate-[float_8s_ease-in-out_infinite]" />
        <Atom className="absolute bottom-1/3 left-1/3 w-24 h-24 text-orange-400/35 animate-[float_10s_ease-in-out_infinite]" />
        <GraduationCap className="absolute top-1/2 right-1/3 w-20 h-20 text-purple-400/35 animate-[float_11s_ease-in-out_infinite]" />

        {/* ✨ PARTICULAS 1 */}
        {particles1.map((p, i) => (
          <div
            key={`p1-${i}`}
            className="absolute bg-white/60 rounded-full animate-twinkle"
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

        {/* ✨ PARTICULAS 2 */}
        {particles2.map((p, i) => (
          <div
            key={`p2-${i}`}
            className="absolute bg-cyan-200/40 rounded-full animate-twinkle"
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

        {/* ✨ PARTICULAS 3 */}
        {particles3.map((p, i) => (
          <div
            key={`p3-${i}`}
            className="absolute bg-purple-300/40 rounded-full animate-twinkle"
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

      {/* 🌟 CONTEÚDO PRINCIPAL */}
      <div className="container mx-auto px-6 relative z-10">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* 🌟 LEFT - TEXT */}
          <div data-aos="fade-right" className="space-y-8">
            <h1 className="text-glow font-heading font-bold text-3xl md:text-5xl text-white leading-tight pt-10">
              Transformando a educação com{" "}
              <span className="text-cyan-400">Tecnologia</span>,{" "}
              <span className="text-green-400">Criatividade</span> e{" "}
              <span className="text-orange-500">Protagonismo Estudantil.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/90 max-w-xl">
              Metodologias Ativas, Robótica, Tecnologia Maker, a abordagem STEAM, Inteligência Artificial (IA) e Educação Socioemocional são fundamentais para preparar os alunos para os desafios da Educação 5.0.
            </p>

            {/* BUTTONS */}
            <div className="flex flex-col md:flex-row gap-4">
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 hover:scale-[1.05]"
                onClick={scrollToContact}
              >
                Leve a Blue World 9 para sua escola
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="border-white bg-white/10 hover:bg-cyan-500 hover:border-cyan-500 text-white text-lg px-8 backdrop-blur hover:scale-[1.05]"
                onClick={scrollToContact}
              >
                Solicite uma apresentação
              </Button>
            </div>
          </div>

          {/* 🌟 RIGHT - IMAGEM */}
          <div data-aos="fade-left" className="relative w-full aspect-square">
            <div className="absolute -inset-4 bg-white/10 blur-2xl rounded-3xl" />

            <Image
              src="/webp/img-01.webp"
              alt="Tecnologia e Educação"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain relative hero-floating rounded-3xl"
            />
          </div>
        </div>

        {/* 🔢 CONTADORES */}
        <div data-aos="fade-up" className="md:grid-cols-3 justify-items-center grid grid-cols-1 mt-20 pt-10 border-t border-white/20 text-glow">
          <div>
            <div className="text-5xl font-bold text-white">+{counts.schools}</div>
            <p className="text-white/80 text-sm">Escolas</p>
          </div>

          <div>
            <div className="text-5xl font-bold text-white md:pt-1 pt-20">+{counts.students.toLocaleString()}</div>
            <p className="text-white/80 text-sm">Alunos</p>
          </div>

          <div>
            <div className="text-5xl font-bold text-white md:pt-1 pt-20">+{counts.projects}</div>
            <p className="text-white/80 text-sm">Projetos Maker</p>
          </div>
        </div>

      </div>

      {/* 🌫️ GRADIENTE DE TRANSIÇÃO */}
      <div className="absolute bottom-0 left-0 right-0 h-40 z-[5]
      bg-gradient-to-b from-transparent to-slate-950" />

    </section>
  )
}
