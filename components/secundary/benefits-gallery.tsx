"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2, TrendingUp, ChevronLeft, Target, Zap, Heart, Lightbulb, Award, Rocket, Brain, ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

const iconMap = { CheckCircle2, TrendingUp, Brain, Heart, Target, Zap, Lightbulb, Award, Rocket }
type Principle = {
  icon: keyof typeof iconMap
  title: string
  description: string
  image?: string
  gradient: string
  borderColor: string
  hoverBorder: string
  iconBg: string
  iconColor: string
  hoverIconBg: string
  shadowColor: string
}
const principles: Principle[] = [
  {
    icon: "Brain",
    title: "Desenvolvimento Cognitivo",
    description:
      "Estimula pensamento crítico, resolução de problemas e criatividade através de metodologias ativas.",
    gradient: "from-green-500/10 to-emerald-500/10",
    image: "/webp/benefits-comp/b-01.webp",
    borderColor: "border-green-400/50",
    hoverBorder: "hover:border-green-300",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-500",
    hoverIconBg: "group-hover:bg-green-500",
    shadowColor: "hover:shadow-green-500/20",
  },
  {
    icon: "Heart",
    title: "Educação Socioemocional",
    description:
      "Desenvolve inteligência emocional, empatia, colaboração e habilidades de liderança.",
    gradient: "from-green-500/10 to-emerald-500/10",
    image: "/webp/benefits-comp/b-02.webp",
    borderColor: "border-green-400/50",
    hoverBorder: "hover:border-green-300",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-500",
    hoverIconBg: "group-hover:bg-green-500",
    shadowColor: "hover:shadow-green-500/20",
  },
  {
    icon: "Zap",
    title: "Protagonismo Estudantil",
    description:
      "Coloca o aluno como centro do aprendizado, promovendo autonomia e responsabilidade.",
    gradient: "from-green-500/10 to-emerald-500/10",
    image: "/webp/benefits-comp/b-03.webp",
    borderColor: "border-green-400/50",
    hoverBorder: "hover:border-green-300",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-500",
    hoverIconBg: "group-hover:bg-green-500",
    shadowColor: "hover:shadow-green-500/20",
  },
  {
    icon: "TrendingUp",
    title: "Preparação para o Futuro",
    description:
      "Ensina competências essenciais: criatividade, inovação, comunicação e adaptabilidade.",
    gradient: "from-green-500/10 to-emerald-500/10",
    image: "/webp/benefits-comp/b-04.webp",
    borderColor: "border-green-400/50",
    hoverBorder: "hover:border-green-300",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-500",
    hoverIconBg: "group-hover:bg-green-500",
    shadowColor: "hover:shadow-green-500/20",
  },
  {
    icon: "CheckCircle2",
    title: "Aumento de Engajamento",
    description:
      "Alunos mais motivados, participativos e conectados com o processo educacional.",
    gradient: "from-green-500/10 to-emerald-500/10",
    image: "/webp/benefits-comp/b-05.webp",
    borderColor: "border-green-400/50",
    hoverBorder: "hover:border-green-300",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-500",
    hoverIconBg: "group-hover:bg-green-500",
    shadowColor: "hover:shadow-green-500/20",
  },
  {
    icon: "Zap",
    title: "Resultados Mensuráveis",
    description:
      "Acompanhamento de progresso com dados e relatórios que demonstram impacto real.",
    gradient: "from-green-500/10 to-emerald-500/10",
    image: "/webp/benefits-comp/b-06.webp",
    borderColor: "border-green-400/50",
    hoverBorder: "hover:border-green-300",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-500",
    hoverIconBg: "group-hover:bg-green-500",
    shadowColor: "hover:shadow-green-500/20",
  },
]

function PrincipleCard({ principle }: { principle: Principle }) {
  const Icon = iconMap[principle.icon]

  return (
    <div
    data-aos="fade-up"
      className={`
        flex flex-col h-full
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br ${principle.gradient}
        border ${principle.borderColor} ${principle.hoverBorder}
        backdrop-blur
        transition-all duration-300
        hover:-translate-y-1 ${principle.shadowColor}
      `}
    >
      {principle.image && (
        <div className="relative w-full aspect-[16/9]">
          <Image
            src={principle.image}
            alt={principle.title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
        </div>
      )}
      <div className="p-6 flex flex-col flex-1">
        <div
          className={`mb-4 p-3 ${principle.iconBg} rounded-lg w-fit ${principle.hoverIconBg} transition-all`}
        >
          <Icon className={`w-6 h-6 ${principle.iconColor}`} />
        </div>

        <h3 className="font-heading text-xl font-bold text-white mb-3">
          {principle.title}
        </h3>

        <p className="text-slate-200 leading-relaxed">
          {principle.description}
        </p>
      </div>
    </div>
  )
}
export function PrinciplesGallery() {
  const [index, setIndex] = useState(0)

  const next = () =>
    setIndex((prev) => (prev + 1) % principles.length)

  const prev = () =>
    setIndex((prev) =>
      prev === 0 ? principles.length - 1 : prev - 1
    )

  useEffect(() => {
    const interval = setInterval(next, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className="hidden md:grid grid-cols-3 gap-8 items-stretch">
        {principles.map((p, i) => (
          <PrincipleCard key={i} principle={p} />
        ))}
      </div>

      <div className="md:hidden relative max-w-sm mx-auto">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {principles.map((p, i) => (
              <div
                key={i}
                className="w-full flex-shrink-0 px-3 flex justify-center"
              >
                <PrincipleCard principle={p} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-6 mt-6">
          <Button className="hover:bg-green-600" size="icon" variant="outline" onClick={prev}>
            <ChevronLeft />
          </Button>
          <Button className="hover:bg-green-600" size="icon" variant="outline" onClick={next}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  )
}
