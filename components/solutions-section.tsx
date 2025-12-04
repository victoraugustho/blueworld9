"use client"

import { Zap, Users, Lightbulb, Award, Code, Rocket, Sparkles, Trophy, SmilePlus, Radio } from "lucide-react"
import { AnimatedBackground } from "./animated-background"
import Image from "next/image"

export function SolutionsSection() {
  const solutions = [
    {
      icon: Code,
      title: "Plataforma de Aprendizado",
      description:
        "LMS intuitiva com conteúdo interativo, gamificação e acompanhamento em tempo real do progresso dos alunos.",
      gradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-400/50",
      hoverBorder: "hover:border-purple-300",
      iconColor: "text-purple-500",
      badgeColor: "bg-purple-500/20 text-purple-600",
    },
    {
      icon: Users,
      title: "Capacitação de Professores",
      description: "Oferecemos uma Formação Docente Contínua e focada em resultados. Nosso programa integra Metodologias Ativas, a abordagem STEAM e a Educação Socioemocional, capacitando seus professores a revolucionar a experiência de aprendizado em sala de aula.",
      gradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-400/50",
      hoverBorder: "hover:border-purple-300",
      iconColor: "text-purple-500",
      badgeColor: "bg-purple-500/20 text-purple-600",
    },
    {
      icon: Lightbulb,
      title: "Projetos Maker",
      description:
        "Ambientes de Criação e Inovação onde nossos alunos desenvolvem soluções reais por meio da prototipagem e experimentação, formando as bases dos inovadores do futuro.",
      gradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-400/50",
      hoverBorder: "hover:border-purple-300",
      iconColor: "text-purple-500",
      badgeColor: "bg-purple-500/20 text-purple-600",
    },
    {
      icon: Award,
      title: "BNCC",
      description: "Base Nacional Comum Curricular, que define as aprendizagens essenciais (competências e habilidades) que todos os alunos devem desenvolver na Educação Básica.",
      gradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-400/50",
      hoverBorder: "hover:border-purple-300",
      iconColor: "text-purple-500",
      badgeColor: "bg-purple-500/20 text-purple-600",
    },
    {
      icon: Rocket,
      title: "Inovação Pedagógica",
      description:
        "Metodologias que preparam alunos para os desafios do futuro com foco em pensamento crítico e criatividade.",
      gradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-400/50",
      hoverBorder: "hover:border-purple-300",
      iconColor: "text-purple-500",
      badgeColor: "bg-purple-500/20 text-purple-600",
    },
    {
      icon: Zap,
      title: "Tecnologia Educacional Estratégica",
      description:
        "Aplicamos uma integração intencional de Inteligência Artificial (IA), robótica e ferramentas digitais avançadas para tornar o aprendizado não apenas prático, mas profundamente significativo e relevante para o futuro de nossos alunos.",
      gradient: "from-purple-500/10 to-pink-500/10",
      borderColor: "border-purple-400/50",
      hoverBorder: "hover:border-purple-300",
      iconColor: "text-purple-500",
      badgeColor: "bg-purple-500/20 text-purple-600",
    },
  ]

  return (
    <section className="relative py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <AnimatedBackground variant="solutions" />
      <div className="container mx-auto px-6 relative z-10 max-w-300">
        <div data-aos="fade-down" className="text-center mb-16 space-y-4">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/50 rounded-full backdrop-blur">
            <p className="text-sm font-semibold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              NOSSAS SOLUÇÕES
            </p>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
            Soluções Completas para{" "}
            <span className="text-white/80">
              Educação Transformadora
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Oferecemos um ecossistema integrado de tecnologia, metodologia e suporte pedagógico para escolas que desejam
            inovar.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div data-aos="fade-right" className="space-y-6 order-2 lg:order-1">
            <h3 className="font-heading text-3xl font-bold text-orange-400">Tecnologia que Faz a Diferença</h3>
            <p className="text-lg text-slate-300 leading-relaxed">
              Oferecemos uma plataforma completa e integrada que conecta professores, alunos e gestores em um
              ecossistema de aprendizado colaborativo e inovador.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Code className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-slate-300 text-sm">LMS Moderno</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-slate-300 text-sm">Capacitação</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-slate-300 text-sm">Maker Space</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-slate-300 text-sm">IA & Robótica</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <SmilePlus className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-slate-300 text-sm">Socioemocional</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Radio className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-slate-300 text-sm">Social Network</span>
              </div>
            </div>
          </div>

          <div data-aos="fade-left" className="relative order-1 lg:order-2 w-full max-w-md mx-auto">
            {/* BOX ARREDONDADO COM A IMAGEM */}
            <div className="relative aspect-square rounded-2xl overflow-hidden z-[1]">
              <Image
                src="/webp/alunos-tecnologia.webp"
                alt="Professor guiando alunos em atividades STEAM"
                fill
                sizes="(max-width: 768px) 100vw,
                      (max-width: 1200px) 50vw,
                      33vw"
                className="object-cover object-center"
              />
            </div>
            {/* ÍCONES FLUTUANTES — FORA DO OVERFLOW-HIDDEN */}
            <div className="absolute inset-0 pointer-events-none z-[5]">

                <div className="absolute -top-4 -left-4 w-16 h-16 
                bg-gradient-to-br from-blue-500 to-cyan-500 
                rounded-full flex items-center justify-center 
                shadow-lg animate-bounce">
                <Code className="w-8 h-8 text-white" />
                </div>

                <div className="absolute top-1/4 -right-6 w-14 h-14 
                bg-gradient-to-br from-yellow-500 to-orange-500 
                rounded-full flex items-center justify-center 
                shadow-lg animate-pulse">
                <Sparkles className="w-7 h-7 text-white" />
                </div>

                <div
                className="absolute -bottom-6 left-1/4 w-[72px] h-[72px] 
                    bg-gradient-to-br from-purple-500 to-pink-500 
                    rounded-full flex items-center justify-center 
                    shadow-lg animate-bounce"
                style={{ animationDelay: "0.3s" }}
                >
                <Trophy className="w-9 h-9 text-white" />
                </div>

                <div
                className="absolute bottom-1/3 -left-6 w-12 h-12 
                    bg-gradient-to-br from-green-500 to-emerald-500 
                    rounded-full flex items-center justify-center 
                    shadow-lg animate-pulse"
                style={{ animationDelay: "0.5s" }}
                >
                <Rocket className="w-6 h-6 text-white" />
                </div>

            </div>

            </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutions.map((solution, index) => {
            const Icon = solution.icon
            return (
              <div
                key={index}
                data-aos="fade-up"
                className={`group relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br ${solution.gradient} border ${solution.borderColor} ${solution.hoverBorder} backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-300" />

                <div className="relative">
                  <div
                    className={`mb-4 p-3 ${solution.badgeColor} rounded-lg w-fit group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={`w-6 h-6 ${solution.iconColor}`} />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-white mb-3">{solution.title}</h3>
                  <p className="text-slate-200 leading-relaxed">{solution.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
