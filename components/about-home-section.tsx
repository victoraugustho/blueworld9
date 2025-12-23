"use client"
import { Zap, Users, Target, Code, Rocket, Lightbulb, Award } from "lucide-react"
import { AnimatedBackground } from "./animated-background"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { PrinciplesGallery } from "@/components/secundary/about-gallery"


export function AboutHomeSection() {

  const router = useRouter()

  return (
    <section className="relative py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <AnimatedBackground variant="about" />
      {/* HEADER */}
      <div className="container mx-auto px-6 relative z-10 max-w-300">
        <div data-aos="fade-down" className="text-center mb-16 space-y-4">
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
            Integramos as melhores práticas com a vanguarda da inovação tecnológica, garantindo que cada estudante esteja totalmente preparado para os desafios do século XXI.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-2">
          <div className="relative w-full max-w-md mx-auto">
            {/* BOX COM BORDA ARREDONDADA E CLIP DA IMAGEM */}
            <div data-aos="fade-up" className="relative aspect-square rounded-2xl overflow-hidden z-[1]">
              <Image
                src="/webp/sala-de-aula.webp"
                alt="Estudantes trabalhando com robótica e tecnologia em sala de aula"
                fill
                priority
                sizes="(max-width: 768px) 100vw,
                      (max-width: 1200px) 50vw,
                      33vw"
                className="object-cover"
              />
            </div>

            {/* ÍCONES FLUTUANTES (FORA DO OVERFLOW-HIDDEN) */}
            <div data-aos="fade-down" className="absolute inset-0 pointer-events-none z-[5]">

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


          <div data-aos="fade-left" className="space-y-6">
            <h3 className="font-heading text-3xl font-bold text-cyan-500">Metodologia Inovadora que Transforma</h3>
            <p className="text-lg text-slate-300 leading-relaxed">
              Combinamos tecnologia de ponta com práticas pedagógicas comprovadas para criar experiências de aprendizado memoráveis e impactantes que preparam nossos alunos para os desafios do futuro.
            </p>
            <div className="w-full flex flex-wrap gap-3">
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
            className="w-full border-white bg-white/10 hover:bg-cyan-500 hover:border-cyan-500 
                        text-white text-lg px-8 backdrop-blur hover:scale-[1.05]"
            onClick={() => router.push("/sobre")} // 👈 coloque seu link aqui
            >
            Saiba Mais
            </Button>
          </div>
        </div>
          <PrinciplesGallery />
      </div>
    </section>
  )
}
