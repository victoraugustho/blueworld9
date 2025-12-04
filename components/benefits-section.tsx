"use client"

import { CheckCircle2, TrendingUp, Heart, Brain, Zap, Star, Sparkles } from "lucide-react"
import { AnimatedBackground } from "./animated-background"
import Image from "next/image"

export function BenefitsSection() {
  const benefits = [
    {
      icon: Brain,
      title: "Desenvolvimento Cognitivo",
      description: "Estimula pensamento crítico, resolução de problemas e criatividade através de metodologias ativas.",
      gradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-400/50",
      iconColor: "text-green-500",
    },
    {
      icon: Heart,
      title: "Educação Socioemocional",
      description: "Desenvolve inteligência emocional, empatia, colaboração e habilidades de liderança.",
      gradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-400/50",
      iconColor: "text-green-500",
    },
    {
      icon: Zap,
      title: "Protagonismo Estudantil",
      description: "Coloca o aluno como centro do aprendizado, promovendo autonomia e responsabilidade.",
      gradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-400/50",
      iconColor: "text-green-500",
    },
    {
      icon: TrendingUp,
      title: "Preparação para o Futuro",
      description: "Ensina competências essenciais: criatividade, inovação, comunicação e adaptabilidade.",
      gradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-400/50",
      iconColor: "text-green-500",
    },
    {
      icon: CheckCircle2,
      title: "Aumento de Engajamento",
      description: "Alunos mais motivados, participativos e conectados com o processo educacional.",
      gradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-400/50",
      iconColor: "text-green-500",
    },
    {
      icon: Zap,
      title: "Resultados Mensuráveis",
      description: "Acompanhamento de progresso com dados e relatórios que demonstram impacto real.",
      gradient: "from-green-500/10 to-emerald-500/10",
      borderColor: "border-green-400/50",
      iconColor: "text-green-500",
    },
  ]

  return (
    <section className="relative py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <AnimatedBackground variant="benefits" />
      <div className="container mx-auto px-6 relative z-10 max-w-300">
        <div data-aos="fade-down" className="text-center mb-16 space-y-4">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/50 rounded-full backdrop-blur">
            <p className="text-sm font-semibold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              BENEFÍCIOS PARA ALUNOS
            </p>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Transformação Real no{" "}
            <br /><span className="text-white/80">
              Desenvolvimento dos Alunos
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Nossos programas desenvolvem competências essenciais para o século XXI, preparando jovens para carreiras de
            sucesso e vida plena.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div data-aos="fade-right" className="relative w-full max-w-md mx-auto">
            {/* IMAGEM ARREDONDADA */}
            <div className="relative aspect-square rounded-2xl overflow-hidden z-[1]">
              <Image
                src="/webp/alunos-geral.webp"
                alt="Professor guiando alunos em atividades STEAM em sala de aula"
                fill
                sizes="(max-width: 768px) 100vw, 
                      (max-width: 1200px) 50vw, 
                      33vw"
                className="object-cover object-center"
              />
            </div>

            {/* ÍCONES FLUTUANTES (FORA DO OVERFLOW) */}
            <div className="absolute inset-0 pointer-events-none z-[5]">

                <div className="absolute -top-6 left-1/4 w-16 h-16
                bg-gradient-to-br from-pink-500 to-rose-500
                rounded-full flex items-center justify-center
                shadow-lg animate-bounce">
                <Heart className="w-8 h-8 text-white" />
                </div>

                <div className="absolute top-1/3 -right-6 w-[72px] h-[72px]
                bg-gradient-to-br from-blue-500 to-cyan-500
                rounded-full flex items-center justify-center
                shadow-lg animate-pulse">
                <Brain className="w-9 h-9 text-white" />
                </div>

                <div
                className="absolute -bottom-4 -left-4 w-14 h-14
                    bg-gradient-to-br from-yellow-500 to-orange-500
                    rounded-full flex items-center justify-center
                    shadow-lg animate-bounce"
                style={{ animationDelay: "0.2s" }}
                >
                <Star className="w-7 h-7 text-white" />
                </div>

                <div
                className="absolute bottom-1/4 -right-4 w-12 h-12
                    bg-gradient-to-br from-purple-500 to-violet-500
                    rounded-full flex items-center justify-center
                    shadow-lg animate-pulse"
                style={{ animationDelay: "1s" }}
                >
                <Sparkles className="w-6 h-6 text-white" />
                </div>

            </div>

          </div>


          <div data-aos="fade-left" className="space-y-6">
            <h3 className="font-heading text-3xl font-bold text-pink-400">Impacto Real na Vida dos Alunos</h3>
            <p className="text-lg text-slate-300 leading-relaxed">
              Nossos programas vão além do conhecimento técnico, focando no desenvolvimento de habilidades socioemocionais e competências essenciais para o sucesso acadêmico, profissional e pessoal no século XXI.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                <span className="text-slate-300">Desenvolvimento Integral: equilíbrio entre o desenvolvimento cognitivo, social e emocional.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                <span className="text-slate-300">Competências para o Futuro: aprimoramento do pensamento crítico, criatividade e resolução de problemas.</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                <span className="text-slate-300">Engajamento Máximo: aumento significativo da motivação e da participação dos alunos.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div
                key={index}
                data-aos="fade-up"
                className={`group relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br ${benefit.gradient} border ${benefit.borderColor} backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-300" />

                <div className="relative">
                  <div
                    className={`mb-4 p-3 bg-white/30 rounded-lg w-fit group-hover:scale-110 group-hover:bg-white/50 transition-all duration-300`}
                  >
                    <Icon className={`w-6 h-6 ${benefit.iconColor}`} />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-white mb-2">{benefit.title}</h3>
                  <p className="text-slate-200 text-sm leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
