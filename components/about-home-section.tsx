"use client"
import { Zap, Users, Target, Code, Rocket, Lightbulb, Award } from "lucide-react"
import { AnimatedBackground } from "./animated-background"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"


export function AboutHomeSection() {
  const principles = [
    {
      icon: Code,
      title: "Criatividade sem Limites",
      description:
        "Ensinamos através da programação para desenvolver liberdade criativa, permitindo que estudantes explorem um mundo sem limites físicos criando ambientes, personagens e ações.",
      gradient: "from-cyan-400/20 to-cyan-600/30",
      borderColor: "border-cyan-600/50",
      hoverBorder: "hover:border-cyan-500",
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-400",
      hoverIconBg: "group-hover:bg-cyan-500",
      shadowColor: "hover:shadow-cyan-500/20",
    },
    {
      icon: Users,
      title: "Aprendizado Acessível",
      description:
        "Material educacional acessível que requer apenas um computador ou notebook, democratizando o acesso à educação de qualidade em tecnologia e inovação.",
      gradient: "from-cyan-400/20 to-cyan-600/30",
      borderColor: "border-cyan-600/50",
      hoverBorder: "hover:border-cyan-500",
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-400",
      hoverIconBg: "group-hover:bg-cyan-500",
      shadowColor: "hover:shadow-cyan-500/20",
    },
    {
      icon: Target,
      title: "Protagonismo Estudantil",
      description:
        "Posicionamos o estudante como o centro do processo criativo, promovendo autonomia e responsabilidade pelo próprio aprendizado e desenvolvimento.",
      gradient: "from-cyan-400/20 to-cyan-600/30",
      borderColor: "border-cyan-600/50",
      hoverBorder: "hover:border-cyan-500",
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-400",
      hoverIconBg: "group-hover:bg-cyan-500",
      shadowColor: "hover:shadow-cyan-500/20",
    },
    {
      icon: Zap,
      title: "Educação 5.0",
      description:
        "Combinamos metodologias ativas, robótica, IA e educação socioemocional para preparar jovens para os desafios do futuro.",
      gradient: "from-cyan-400/20 to-cyan-600/30",
      borderColor: "border-cyan-600/50",
      hoverBorder: "hover:border-cyan-500",
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-400",
      hoverIconBg: "group-hover:bg-cyan-500",
      shadowColor: "hover:shadow-cyan-500/20",
    },
  ]

  const stats = [
    { number: "400k+", label: "Alunos Impactados", color: "from-pink-500 to-orange-500" },
    { number: "3k+", label: "Professores Treinados", color: "from-purple-500 to-pink-500" },
    { number: "2k+", label: "Escolas Parceiras", color: "from-cyan-500 to-blue-500" },
  ]

  const router = useRouter()

  return (
    <section className="relative py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <AnimatedBackground variant="about" />
      {/* HEADER */}
      <div className="container mx-auto px-6 relative z-10 max-w-300">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-cyan-600/20 to-cyan-500/20 border border-cyan-400/50 rounded-full backdrop-blur">
            <p className="text-sm font-semibold text-cyan-500">
              SOBRE NÓS
            </p>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 bg-clip-text text-transparent">
            Transformando Educação através da{" "}
            <span className="text-transparent text-white">
              Tecnologia e Criatividade
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Combinamos as melhores práticas educacionais com inovação tecnológica para preparar estudantes para os
            desafios do século XXI.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-2">
          <div className="relative w-full max-w-md mx-auto">
            {/* BOX COM BORDA ARREDONDADA E CLIP DA IMAGEM */}
            <div className="relative aspect-square rounded-2xl overflow-hidden z-[1]">
                <Image
                src="/img-02.png"
                alt="Estudantes trabalhando com robótica"
                fill
                className="object-cover"
                />
            </div>

            {/* ÍCONES FLUTUANTES (FORA DO OVERFLOW-HIDDEN) */}
            <div className="absolute inset-0 pointer-events-none z-[5]">

                <div className="absolute -top-8 -left-12 w-16 h-16 
                bg-gradient-to-br from-purple-500 to-pink-500 
                rounded-full flex items-center justify-center 
                shadow-lg animate-bounce">
                <Code className="w-8 h-8 text-white" />
                </div>

                <div className="absolute -top-0 -right-6 w-20 h-20 
                bg-gradient-to-br from-blue-500 to-cyan-500 
                rounded-full flex items-center justify-center 
                shadow-lg animate-pulse">
                <Rocket className="w-10 h-10 text-white" />
                </div>

                <div
                className="absolute -bottom-4 -left-6 w-14 h-14 
                    bg-gradient-to-br from-orange-500 to-red-500 
                    rounded-full flex items-center justify-center 
                    shadow-lg animate-bounce"
                style={{ animationDelay: "0.5s" }}
                >
                <Lightbulb className="w-7 h-7 text-white" />
                </div>

                <div
                className="absolute -bottom-6 -right-4 w-[72px] h-[72px] 
                    bg-gradient-to-br from-green-500 to-emerald-500 
                    rounded-full flex items-center justify-center 
                    shadow-lg animate-pulse"
                style={{ animationDelay: "0.3s" }}
                >
                <Award className="w-9 h-9 text-white" />
                </div>

            </div>

            </div>


          <div className="space-y-6">
            <h3 className="font-heading text-3xl font-bold text-cyan-500">Metodologia Inovadora que Transforma</h3>
            <p className="text-lg text-slate-300 leading-relaxed">
              Nossa abordagem combina tecnologia de ponta com práticas pedagógicas comprovadas, criando experiências de
              aprendizado memoráveis e impactantes que preparam os alunos para os desafios do futuro.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full text-yellow-300 text-sm">
                STEAM
              </span>
              <span className="px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full text-yellow-300 text-sm">
                Robótica
              </span>
              <span className="px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full text-yellow-300 text-sm">
                Programação
              </span>
              <span className="px-4 py-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full text-yellow-300 text-sm">
                Maker
              </span>
            </div>
            <Button
            size="lg"
            variant="outline"
            className="border-white bg-white/10 hover:bg-cyan-500 hover:border-cyan-500 
                        text-white text-lg px-8 backdrop-blur hover:scale-[1.05]"
            onClick={() => router.push("/sobre")} // 👈 coloque seu link aqui
            >
            Saiba Mais
            </Button>
          </div>
          

        </div>

        {/* PRINCIPLES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {principles.map((principle, index) => {
            const Icon = principle.icon
            return (
              <div
                key={index}
                className={`relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br ${principle.gradient} border ${principle.borderColor} ${principle.hoverBorder} backdrop-blur ${principle.shadowColor} transition-all duration-300 group hover:shadow-lg cursor-pointer hover:-translate-y-1`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-300" />

                <div className="relative">
                  <div
                    className={`mb-4 p-3 ${principle.iconBg} rounded-lg w-fit ${principle.hoverIconBg} group-hover:text-white transition-all duration-300`}
                  >
                    <Icon className={`w-6 h-6 ${principle.iconColor} group-hover:text-white`} />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-white mb-3">{principle.title}</h3>
                  <p className="text-slate-200 leading-relaxed">{principle.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* STATS - VIBRANT COLORFUL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${stat.color} rounded-2xl p-8 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group`}
            >
              <div className="text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                {stat.number}
              </div>
              <p className="text-white/90 text-lg font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
