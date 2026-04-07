import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Globe2,
  Instagram,
  Mail,
  MessageCircle,
  PlayCircle,
  Sparkles,
  Users,
} from "lucide-react"
import { AnimatedBackground } from "@/components/animated-background"

export const metadata: Metadata = {
  title: "BlueWorld9 | Links Oficiais",
  description: "Todos os links oficiais da BlueWorld9 em um unico lugar.",
  alternates: {
    canonical: "/bio",
  },
}

type BioLink = {
  title: string
  subtitle: string
  href: string
  icon: LucideIcon
  external?: boolean
}

const primaryLinks: BioLink[] = [
  {
    title: "Fale no WhatsApp",
    subtitle: "Atendimento rapido com o time BlueWorld9",
    href: "https://wa.me/5562992752970",
    icon: MessageCircle,
    external: true,
  },
  {
    title: "Site Oficial",
    subtitle: "Conheca programas, projetos e resultados",
    href: "/",
    icon: Globe2,
  },
  {
    title: "Impacto",
    subtitle: "Veja os resultados e transformacoes geradas",
    href: "/impacto",
    icon: Sparkles,
  },
]

const secondaryLinks: BioLink[] = [
  {
    title: "Para Escolas",
    subtitle: "Educacao 5.0 aplicada na pratica",
    href: "/para-escolas",
    icon: Building2,
  },
  {
    title: "Nossa Equipe",
    subtitle: "Quem construi a BlueWorld9",
    href: "/equipe",
    icon: Users,
  },
  {
    title: "Instagram",
    subtitle: "@blueworld9_",
    href: "https://www.instagram.com/blueworld9_",
    icon: Instagram,
    external: true,
  },
  {
    title: "YouTube",
    subtitle: "@BW9Global",
    href: "https://www.youtube.com/@BW9Global",
    icon: PlayCircle,
    external: true,
  },
  {
    title: "Email",
    subtitle: "contato@bw9global.com",
    href: "mailto:contato@bw9global.com",
    icon: Mail,
    external: true,
  },
]

function LinkCard({ link, featured = false }: { link: BioLink; featured?: boolean }) {
  const Icon = link.icon
  const outerClassName = featured
    ? "group block w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 p-[1px] shadow-xl shadow-cyan-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-cyan-300/45"
    : "group block w-full rounded-2xl border border-white/15 bg-slate-900/70 p-4 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900/85 hover:shadow-cyan-500/20"

  const innerClassName = featured
    ? "flex items-center gap-3 rounded-[15px] bg-slate-900/92 px-4 py-4"
    : "flex items-center gap-3"

  const iconClassName = featured
    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/20 to-blue-500/20"
    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10"

  const titleClassName = featured
    ? "block font-heading text-[1.02rem] font-semibold text-white"
    : "block font-heading text-base font-semibold text-white"

  const subtitleClassName = featured
    ? "block truncate text-sm text-cyan-100/85"
    : "block truncate text-sm text-white/70"

  const content = (
    <span className={innerClassName}>
      <span className={iconClassName}>
        <Icon className="h-5 w-5 text-cyan-100 transition-colors group-hover:text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={titleClassName}>{link.title}</span>
        <span className={subtitleClassName}>{link.subtitle}</span>
      </span>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-white/75 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
    </span>
  )

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={outerClassName}>
        {content}
      </a>
    )
  }

  return (
    <Link href={link.href} className={outerClassName}>
      {content}
    </Link>
  )
}

export default function BioPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 pb-14 pt-10 sm:pt-14">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[180px]" />
        <div className="absolute top-1/3 -right-20 h-[480px] w-[480px] rounded-full bg-purple-500/10 blur-[180px]" />
        <div className="absolute -bottom-40 left-0 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[180px]" />
        <div className="hidden md:block">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute h-full w-[2px] bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-[flow_10s_linear_infinite]"
              style={{ left: `${10 + i * 14}%`, animationDelay: `${i}s` }}
            />
          ))}
        </div>
      </div>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <AnimatedBackground variant="default" />
      </div>

      <section className="relative mx-auto w-full max-w-md space-y-4">
        <div className="rounded-3xl border border-white/15 bg-slate-900/70 px-5 py-6 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto w-full max-w-[260px]">
            <Image
              src="/webp/logo-branca-bw9-extends.webp"
              alt="BlueWorld9"
              width={260}
              height={64}
              priority
              className="h-auto w-auto object-contain"
            />
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            Perfil oficial BlueWorld9
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            Tecnologia, inovacao e protagonismo para transformar a educacao.
          </p>
        </div>

        <div className="space-y-3">
          {primaryLinks.map((link) => (
            <LinkCard key={link.title} link={link} featured />
          ))}
        </div>

        <div className="rounded-3xl border border-white/12 bg-slate-900/60 p-4 shadow-xl backdrop-blur-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Mais links</p>
          <div className="space-y-3">
            {secondaryLinks.map((link) => (
              <LinkCard key={link.title} link={link} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
