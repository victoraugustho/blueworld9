import { Target, Eye, Award } from "lucide-react"

export function AboutSection() {
  return (
    <section id="sobre" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-primary text-center mb-6">Sobre Nós</h2>

          <p className="text-lg md:text-xl text-foreground/80 leading-relaxed text-center mb-12">
            A Blue World 9 nasceu com o propósito de transformar a educação, oferecendo programas tecnológicos e
            humanizados que conectam professores e alunos a novas formas de aprender, ensinar e inovar. Nosso
            compromisso é equilibrar tecnologia e sensibilidade, preparando estudantes para o mundo digital sem perder a
            essência humana.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading font-bold text-xl text-primary mb-3">Missão</h3>
              <p className="text-foreground/70 leading-relaxed">
                Revolucionar a educação por meio da tecnologia e da inovação.
              </p>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="font-heading font-bold text-xl text-primary mb-3">Visão</h3>
              <p className="text-foreground/70 leading-relaxed">
                Ser referência em educação tecnológica e humanizada, alcançando milhões de alunos no mundo.
              </p>
            </div>

            <div className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
                <Award className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-heading font-bold text-xl text-primary mb-3">Valores</h3>
              <p className="text-foreground/70 leading-relaxed">
                Excelência, inovação, empatia, ética, colaboração, sustentabilidade e propósito.
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-20">
            <h3 className="font-heading font-bold text-2xl md:text-3xl text-primary text-center mb-12">
              Nossa Trajetória
            </h3>
            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-primary/20" />

              <div className="space-y-12">
                <div className="flex items-center gap-8">
                  <div className="flex-1 text-right">
                    <div className="bg-card rounded-xl p-6 shadow-md inline-block">
                      <h4 className="font-heading font-bold text-lg text-primary mb-2">Fundação</h4>
                      <p className="text-foreground/70">Início da jornada transformando a educação</p>
                    </div>
                  </div>
                  <div className="w-4 h-4 bg-primary rounded-full relative z-10" />
                  <div className="flex-1" />
                </div>

                <div className="flex items-center gap-8">
                  <div className="flex-1" />
                  <div className="w-4 h-4 bg-secondary rounded-full relative z-10" />
                  <div className="flex-1">
                    <div className="bg-card rounded-xl p-6 shadow-md inline-block">
                      <h4 className="font-heading font-bold text-lg text-primary mb-2">Expansão</h4>
                      <p className="text-foreground/70">Crescimento para toda América Latina</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="flex-1 text-right">
                    <div className="bg-card rounded-xl p-6 shadow-md inline-block">
                      <h4 className="font-heading font-bold text-lg text-primary mb-2">Hoje</h4>
                      <p className="text-foreground/70">+20 escolas e +15.000 alunos impactados</p>
                    </div>
                  </div>
                  <div className="w-4 h-4 bg-accent rounded-full relative z-10" />
                  <div className="flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
