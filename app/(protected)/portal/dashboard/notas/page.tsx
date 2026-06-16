import { getEffectivePortalLocale } from "@/lib/portal-locale"
﻿import { requireTeacherPage } from "@/lib/auth/server"
import Link from "next/link"
import { Sigma, ClipboardCheck, CalendarRange } from "lucide-react"
import NotasSectionNav from "./_components/NotasSectionNav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function NotasPage() {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)
  const isEs = locale === "es"
  const cards = [
    {
      href: "/portal/dashboard/notas/lancamentos",
      title: isEs ? "Lanzamiento + Agenda" : "Lancamento + Agenda",
      description: isEs
        ? "Abra la agenda y registre asistencia/notas C1..C4 en el mismo flujo."
        : "Abra a agenda e registre presenca/notas C1..C4 no mesmo fluxo.",
      icon: ClipboardCheck,
    },
    {
      href: "/portal/dashboard/notas/lancamentos",
      title: isEs ? "Clases por Turma" : "Aulas por Turma",
      description: isEs
        ? "Vea todas las clases de una turma y abra una clase especifica."
        : "Veja todas as aulas de uma turma e abra uma aula especifica.",
      icon: CalendarRange,
    },
  ]

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sigma className="w-7 h-7 text-cyan-300" />
          {isEs ? "Modulo de Notas" : "Modulo de Notas"}
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          {isEs
            ? "Flujo separado por paginas: lanzamientos y clases."
            : "Fluxo separado por paginas: lancamentos e aulas."}
        </p>
      </div>

      <NotasSectionNav locale={locale} />

      <Card className="bg-slate-900/35 border border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">
            {isEs ? "Criterios Evaluativos" : "Criterios Avaliativos"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-200 space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
            <p className="font-semibold text-cyan-200">C1 - Resolucao de problemas e pensamento critico</p>
            <p>
              Avaliamos a capacidade do aluno de identificar desafios e buscar solucoes. O material didatico oferece
              as trilhas e provocacoes iniciais, mas cabe ao estudante aplicar o raciocinio logico e estrategias
              proprias para superar obstaculos de forma autonoma.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
            <p className="font-semibold text-cyan-200">C2 - Criatividade e Inovacao</p>
            <p>
              Observamos a habilidade de propor ideias originais. Partindo das referencias do livro, o aluno e
              incentivado a ir alem, explorando novos caminhos e integrando conhecimentos para criar solucoes que nao
              estao necessariamente prontas no papel.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
            <p className="font-semibold text-cyan-200">C3 - Colaboracao e Trabalho em Equipe</p>
            <p>
              Observamos a habilidade de propor ideias originais. Partindo das referencias do livro, o aluno e
              incentivado a ir alem, explorando novos caminhos e integrando conhecimentos para criar solucoes que nao
              estao necessariamente prontas no papel.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
            <p className="font-semibold text-cyan-200">C4 - Aplicacao de Conceitos STEAM e Tecnologia</p>
            <p>
              Analisamos como o aluno transforma a teoria em pratica. E o momento de tirar os conceitos de Ciencias,
              Tecnologia, Engenharia, Artes e Matematica do material e dar vida a eles usando ferramentas, componentes
              e muita mao na massa.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
            <p className="font-semibold text-cyan-200">C5 - Registro e Fundamentacao</p>
            <p>
              Avaliamos o compromisso com o livro e material didatico como ferramenta de registro. O aluno utiliza o
              material para fundamentar suas criacoes e documentar sua evolucao, garantindo que a pratica seja
              acompanhada de uma reflexao organizada.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="group">
              <Card className="h-full bg-slate-900/35 border border-white/10 backdrop-blur-sm group-hover:border-cyan-400/50 transition">
                <CardContent className="pt-6 space-y-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/30">
                    <Icon className="w-5 h-5 text-cyan-200" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                  <p className="text-sm text-slate-300">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

