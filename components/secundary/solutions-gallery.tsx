import {
  Target,
  Zap,
  Users,
  Lightbulb,
  Award,
  Code,
  Rocket,
} from "lucide-react"
import Image from "next/image"

const iconMap = { Code, Users, Target, Zap, Lightbulb, Award, Rocket }

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
    title: "Plataforma de Aprendizado",
    description:
      "LMS intuitiva com conteúdo interativo, gamificação e acompanhamento em tempo real do progresso dos alunos.",
    gradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-400/50",
    hoverBorder: "hover:border-purple-300",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    hoverIconBg: "group-hover:bg-purple-500",
    shadowColor: "hover:shadow-purple-500/20",
  },
  {
    icon: "Users",
    title: "Capacitação de Professores",
    description:
      "Oferecemos uma Formação Docente Contínua e focada em resultados. Nosso programa integra Metodologias Ativas, a abordagem STEAM e a Educação Socioemocional, capacitando seus professores a revolucionar a experiência de aprendizado em sala de aula.",
    gradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-400/50",
    hoverBorder: "hover:border-purple-300",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    hoverIconBg: "group-hover:bg-purple-500",
    shadowColor: "hover:shadow-purple-500/20",
  },
  {
    icon: "Lightbulb",
    title: "Projetos Maker",
    description:
      "Ambientes de Criação e Inovação onde nossos alunos desenvolvem soluções reais por meio da prototipagem e experimentação, formando as bases dos inovadores do futuro.",
    gradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-400/50",
    hoverBorder: "hover:border-purple-300",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    hoverIconBg: "group-hover:bg-purple-500",
    shadowColor: "hover:shadow-purple-500/20",
  },
  {
    icon: "Award",
    title: "BNCC",
    description:
      "Base Nacional Comum Curricular, que define as aprendizagens essenciais (competências e habilidades) que todos os alunos devem desenvolver na Educação Básica.",
    gradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-400/50",
    hoverBorder: "hover:border-purple-300",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    hoverIconBg: "group-hover:bg-purple-500",
    shadowColor: "hover:shadow-purple-500/20",
  },
  {
    icon: "Rocket",
    title: "Inovação Pedagógica",
    description:
      "Metodologias que preparam alunos para os desafios do futuro com foco em pensamento crítico e criatividade.",
    gradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-400/50",
    hoverBorder: "hover:border-purple-300",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    hoverIconBg: "group-hover:bg-purple-500",
    shadowColor: "hover:shadow-purple-500/20",
  },
  {
    icon: "Zap",
    title: "Tecnologia Educacional Estratégica",
    description:
      "Aplicamos uma integração intencional de Inteligência Artificial (IA), robótica e ferramentas digitais avançadas para tornar o aprendizado não apenas prático, mas profundamente significativo e relevante para o futuro de nossos alunos.",
    gradient: "from-purple-500/10 to-pink-500/10",
    borderColor: "border-purple-400/50",
    hoverBorder: "hover:border-purple-300",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    hoverIconBg: "group-hover:bg-purple-500",
    shadowColor: "hover:shadow-purple-500/20",
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
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 30vw"
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
  return (
    <>
      <div className="hidden md:grid grid-cols-3 gap-8 items-stretch">
        {principles.map((p, i) => (
          <PrincipleCard key={i} principle={p} />
        ))}
      </div>

      <div className="md:hidden overflow-x-auto pb-2">
        <div className="flex gap-4 snap-x snap-mandatory">
          {principles.map((p, i) => (
            <div key={i} className="min-w-[85%] snap-center">
              <PrincipleCard principle={p} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
