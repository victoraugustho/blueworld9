"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"
import { BookOpen, Cpu, Lightbulb, Atom, GraduationCap } from "lucide-react"
import Image from "next/image"

export function HeroSection() {
  const [counts, setCounts] = useState({
    schools: 0,
    students: 0,
    projects: 0,
  })

  useEffect(() => {
    const targets = { schools: 20, students: 15000, projects: 100 }
    const duration = 2000
    const start = performance.now()

    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1)

      setCounts({
        schools: Math.floor(targets.schools * progress),
        students: Math.floor(targets.students * progress),
        projects: Math.floor(targets.projects * progress),
      })

      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [])

  const scrollToContact = () => {
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })
  }

  const particles = useMemo(
    () =>
      Array.from({ length: 80 }).map(() => ({
        size: 1 + Math.random() * 4,
        top: Math.random() * 100,
        left: Math.random() * 100,
        opacity: 0.2 + Math.random() * 0.6,
        blur: Math.random() * 4,
        duration: 3 + Math.random() * 5,
        color: Math.random() > 0.66
          ? "bg-white/60"
          : Math.random() > 0.33
          ? "bg-cyan-200/40"
          : "bg-purple-300/40",
      })),
    []
  )

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-32 pb-20">
      {/* Background */}
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

      {/* Efeitos */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[2px] h-full bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent animate-[flow_10s_linear_infinite]"
            style={{ left: `${10 + i * 14}%`, animationDelay: `${i}s` }}
          />
        ))}

        <div className="absolute top-20 left-1/3 w-96 h-96 bg-cyan-400/20 rounded-full blur-[120px] animate-[organicMove_14s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[140px] animate-[organicMove_16s_ease-in-out_infinite]" />

        <BookOpen className="absolute top-32 left-12 w-20 h-20 text-white/30 animate-[float_8s_ease-in-out_infinite]" />
        <Cpu className="absolute bottom-40 right-24 w-24 h-24 text-cyan-300/40 animate-[float_10s_ease-in-out_infinite]" />
        <Lightbulb className="absolute top-1/4 right-14 w-20 h-20 text-yellow-300/40 animate-[float_9s_ease-in-out_infinite]" />
        <Atom className="absolute bottom-1/3 left-1/3 w-24 h-24 text-orange-400/35 animate-[float_11s_ease-in-out_infinite]" />
        <GraduationCap className="absolute top-1/2 right-1/3 w-20 h-20 text-purple-400/35 animate-[float_12s_ease-in-out_infinite]" />

        {particles.map((p, i) => (
          <div
            key={i}
            className={`absolute rounded-full animate-twinkle ${p.color}`}
            style={{
              width: p.size,
              height: p.size,
              top: `${p.top}%`,
              left: `${p.left}%`,
              opacity: p.opacity,
              filter: `blur(${p.blur}px)`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h1 className="text-glow font-heading font-bold text-3xl md:text-5xl text-white leading-tight pt-10">
              Transformando a educação com{" "}
              <span className="text-cyan-400">Tecnologia</span>,{" "}
              <span className="text-green-400">Criatividade</span> e{" "}
              <span className="text-orange-500">Protagonismo Estudantil.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/90 max-w-xl">
              Metodologias Ativas, Robótica, Tecnologia Maker, STEAM, IA e Educação
              Socioemocional para preparar alunos para a Educação 5.0.
            </p>

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

          <div className="relative w-full aspect-square">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-20 pt-10 border-t border-white/20 text-glow text-center">
          <div>
            <div className="text-5xl font-bold text-white">+{counts.schools}</div>
            <p className="text-white/80 text-sm">Escolas</p>
          </div>

          <div>
            <div className="text-5xl font-bold text-white">
              +{counts.students.toLocaleString()}
            </div>
            <p className="text-white/80 text-sm">Alunos</p>
          </div>

          <div>
            <div className="text-5xl font-bold text-white">+{counts.projects}</div>
            <p className="text-white/80 text-sm">Projetos Maker</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 z-[5] bg-gradient-to-b from-transparent to-slate-950" />
    </section>
  )
}
