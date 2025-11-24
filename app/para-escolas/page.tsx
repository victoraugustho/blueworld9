import { GraduationCap, Wrench, Heart, FileText, Sparkles } from 'lucide-react'
import { Button } from "@/components/ui/button"
import Link from "next/link"

const features = [
  {
    icon: GraduationCap,
    title: "Formação Docente",
    description: "Mentoria contínua e capacitação para professores",
  },
  {
    icon: FileText,
    title: "Integração BNCC e ODS",
    description: "Programas alinhados com diretrizes nacionais e globais",
  },
  {
    icon: Wrench,
    title: "Ambientes Maker e STEAM",
    description: "Espaços completos para aprendizagem prática",
  },
  {
    icon: Heart,
    title: "Acompanhamento Socioemocional",
    description: "Suporte pedagógico e emocional integrado",
  },
  {
    icon: FileText,
    title: "Relatórios Personalizados",
    description: "Análises detalhadas do progresso dos alunos",
  },
  {
    icon: Sparkles,
    title: "Consultoria Especializada",
    description: "Suporte técnico e pedagógico dedicado",
  },
]

export default function ParaEscolasPage() {
  return (
    <main className="min-h-screen pt-20 bg-primary">
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h1 className="font-heading font-bold text-4xl md:text-6xl text-white mb-6">Para Escolas</h1>
            <p className="text-lg md:text-xl text-white/80 leading-relaxed">
              A Blue World 9 oferece soluções completas e personalizadas para escolas que desejam inovar com propósito.
              Oferecemos acompanhamento pedagógico, técnico e socioemocional, formação docente e integração total à
              comunidade escolar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="bg-white/20 rounded-2xl border-white/60 border-1 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="font-heading font-bold text-xl text-white mb-3">{feature.title}</h2>
                  <p className="text-white/70 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>

          {/* CTA Banner */}
          <div className="max-w-4xl mx-auto">
            <div className="border-white border bg-gradient-to-r from-primary via-cyan-600 to-purple-800 rounded-2xl p-8 md:p-12 text-center shadow-2xl">
              <h2 className="font-heading font-bold text-2xl md:text-4xl text-white mb-4">
                Descubra como transformar sua escola com a Blue World 9
              </h2>
              <p className="text-white/90 text-lg mb-8">Entre em contato e conheça nossas soluções personalizadas</p>
              <Link href="/#contato">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-8">
                  Solicitar Apresentação
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
