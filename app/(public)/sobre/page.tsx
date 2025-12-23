import { Target, Eye, Award } from "lucide-react"
import { Footer } from "@/components/footer"
import { AnimatedBackground } from "@/components/animated-background"
import { SouthAmericaInteractiveMap } from "@/components/map-interativo"

export default function SobrePage() {
  return (
    <main className="min-h-screen">
      <section className="relative py-30 md:py-42 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"><AnimatedBackground />
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div data-aos="fade-up">
              <h1 className="font-heading font-bold text-4xl md:text-6xl text-cyan-400 text-center mb-6">Sobre Nós</h1>

              <p className="text-lg md:text-xl text-white/80 leading-relaxed text-center mb-12">
                A Blue World 9 nasceu com o propósito de transformar a educação, oferecendo programas tecnológicos e
                humanizados que conectam professores e alunos a novas formas de aprender, ensinar e inovar. Nosso
                compromisso é equilibrar tecnologia e sensibilidade, preparando estudantes para o mundo digital sem perder
                a essência humana.
              </p>
            </div>

            <div data-aos="fade-up" className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8 shadow-lg hover:shadow-xl hover:border-cyan-400/50 transition-all">
                <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Target className="w-7 h-7 text-cyan-400" />
                </div>
                <h2 className="font-heading font-bold text-xl text-cyan-400 mb-3">Missão</h2>
                <p className="text-white/70 leading-relaxed">
                  Revolucionar a educação por meio da tecnologia e da inovação.
                </p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-8 shadow-lg hover:shadow-xl hover:border-blue-400/50 transition-all">
                <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Eye className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="font-heading font-bold text-xl text-blue-400 mb-3">Visão</h2>
                <p className="text-white/70 leading-relaxed">
                  Ser referência em educação tecnológica e humanizada, alcançando milhões de alunos no mundo.
                </p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-8 shadow-lg hover:shadow-xl hover:border-purple-400/50 transition-all">
                <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Award className="w-7 h-7 text-purple-400" />
                </div>
                <h2 className="font-heading font-bold text-xl text-purple-400 mb-3">Valores</h2>
                <p className="text-white/70 leading-relaxed">
                  Excelência, inovação, empatia, ética, colaboração, sustentabilidade e propósito.
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div data-aos="fade-up" className="mt-20">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-cyan-400 text-center mb-12">
                Nossa Trajetória
              </h2>
              <div className="relative">
                <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-cyan-500/50 via-blue-500/30 to-transparent" />

                <div className="space-y-12">
                  <div className="flex items-center gap-8">
                    <div className="flex-1 text-right">
                      <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6 shadow-md inline-block">
                        <h3 className="font-heading font-bold text-lg text-cyan-400 mb-2">Fundação</h3>
                        <p className="text-white/70">Início da jornada transformando a educação</p>
                      </div>
                    </div>
                    <div className="w-4 h-4 bg-cyan-400 rounded-full relative z-10" />
                    <div className="flex-1" />
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex-1" />
                    <div className="w-4 h-4 bg-blue-400 rounded-full relative z-10" />
                    <div className="flex-1">
                      <div className="bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-6 shadow-md inline-block">
                        <h3 className="font-heading font-bold text-lg text-blue-400 mb-2">Expansão</h3>
                        <p className="text-white/70">Crescimento para toda América Latina</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex-1 text-right">
                      <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 shadow-md inline-block">
                        <h3 className="font-heading font-bold text-lg text-purple-400 mb-2">Hoje</h3>
                        <p className="text-white/70">+20 escolas e +15.000 alunos impactados</p>
                      </div>
                    </div>
                    <div className="w-4 h-4 bg-purple-400 rounded-full relative z-10" />
                    <div className="flex-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/*<div>
            <SouthAmericaInteractiveMap />
          </div>*/}
        </div>
      </section>
      <Footer />
    </main>
    
  )
}
