"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Code,
  Users,
  Target,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

const iconMap = { Code, Users, Target, Zap }
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
    icon: "Code",
    title: "Criatividade sem Limites",
    description:
      "Ensinamos através da programação para desenvolver liberdade criativa, permitindo que estudantes explorem um mundo sem limites físicos criando ambientes, personagens e ações.",
    image: "/webp/about-comp/01.webp",
    gradient: "from-cyan-400/20 to-cyan-600/30",
    borderColor: "border-cyan-600/50",
    hoverBorder: "hover:border-cyan-500",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    hoverIconBg: "group-hover:bg-cyan-500",
    shadowColor: "hover:shadow-cyan-500/20",
  },
  {
    icon: "Users",
    title: "Experiência Prática Simplificada",
    description:
      "A abordagem STEAM só se completa com a ação. Por isso, a metodologia inclui recursos tangíveis e tecnológicos que possibilitam o aprendizado prático.",
    image: "/webp/about-comp/02.webp",
    gradient: "from-cyan-400/20 to-cyan-600/30",
    borderColor: "border-cyan-600/50",
    hoverBorder: "hover:border-cyan-500",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    hoverIconBg: "group-hover:bg-cyan-500",
    shadowColor: "hover:shadow-cyan-500/20",
  },
  {
    icon: "Target",
    title: "Protagonismo Estudantil",
    description:
      "Posicionamos o estudante como o centro do processo criativo, promovendo autonomia e responsabilidade pelo próprio aprendizado.",
    image: "/webp/about-comp/03.webp",
    gradient: "from-cyan-400/20 to-cyan-600/30",
    borderColor: "border-cyan-600/50",
    hoverBorder: "hover:border-cyan-500",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    hoverIconBg: "group-hover:bg-cyan-500",
    shadowColor: "hover:shadow-cyan-500/20",
  },
  {
    icon: "Zap",
    title: "Educação 5.0",
    description:
      "Aplicamos STEAM, Metodologias Ativas, IA e Educação Socioemocional, preparando nossos alunos para os desafios complexos do futuro.",
    image: "/webp/about-comp/04.webp",
    gradient: "from-cyan-400/20 to-cyan-600/30",
    borderColor: "border-cyan-600/50",
    hoverBorder: "hover:border-cyan-500",
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    hoverIconBg: "group-hover:bg-cyan-500",
    shadowColor: "hover:shadow-cyan-500/20",
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
        <div className="relative w-full aspect-[16/09]">
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
      <div className="hidden md:grid grid-cols-2 gap-8 items-stretch">
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
          <Button className="hover:bg-cyan-600" size="icon" variant="outline" onClick={prev}>
            <ChevronLeft />
          </Button>
          <Button className="hover:bg-cyan-600" size="icon" variant="outline" onClick={next}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  )
}
