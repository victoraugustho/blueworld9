"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, MapPin, Users, School, Globe, Heart, Star, Sparkles, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedBackground } from "@/components/animated-background"
import { Footer } from "@/components/footer"
import { VideoTestimonialsCarousel } from "@/components/subpage/depoiments"

const testimonials = [
  {
    name: "Fabiana Vieira",
    role: "Educadora Maker STEAM",
    text: "Ver nossos alunos explorando, criando e se superando nas práticas Maker STEAM é sempre emocionante. Cada conquista, por menor que seja, revela o potencial e a capacidade deles. Na Blue World, fortalecemos esse crescimento com cuidado, propósito e profundo significado.",
    image: "/webp/depoimento-01-fabiana-vieira.webp",
  },
  {
    name: "Isabele Brum",
    role: "Diretora escolar",
    text: "A Blue World 9 é muito mais do que um ambiente de aprendizagem. É um universo onde a criatividade floresce, a tecnologia impulsiona a autonomia e cada estudante é motivado a descobrir e desenvolver todo o seu potencial. É um espaço que inspira, transforma e molda os talentos que construirão o futuro. Porque aprender com propósito faz toda a diferença.",
    image: "/webp/depoimento-02-att.webp",
  },
  {
    name: "Francis Mello",
    role: "Coordenadora Pedagógica",
    text: "As aulas de Blue World - Robótica foram um sucesso em nossa unidade! Com criatividade e diversão, os alunos exploraram o mundo da tecnologia e da inovação, desenvolvendo habilidades essenciais para o futuro.",
    image: "/webp/depoimento-03.webp",
  },
]

const impactMetrics = [
  { icon: School, label: "Escolas Impactadas", value: "20+", color: "from-purple-500 to-pink-500" },
  { icon: Users, label: "Alunos Transformados", value: "15.000+", color: "from-cyan-500 to-blue-500" },
  { icon: Globe, label: "Países na América Latina", value: "3", color: "from-orange-500 to-red-500" },
  { icon: Award, label: "Projetos Realizados", value: "100+", color: "from-green-500 to-emerald-500" },
]

const photos = [
  {
    src: "/webp/impact-moments/t-01.webp",
    alt: "Alunos trabalhando com robótica",
    color: "from-purple-500 to-pink-500",
  },
  {
    src: "/webp/impact-moments/t-02.webp",
    alt: "Professor orientando atividades STEAM",
    color: "from-cyan-500 to-blue-500",
  },
  /*{
    src: "/webp/impact-moments/t-03.webp",
    alt: "Alunos apresentando projeto",
    color: "from-orange-500 to-yellow-500",
  },*/
  {
    src: "/webp/impact-moments/t-04.webp",
    alt: "Projeto de robótica educacional",
    color: "from-green-500 to-emerald-500",
  },
  {
    src: "/webp/impact-moments/t-05.webp",
    alt: "Atividades maker space",
    color: "from-pink-500 to-rose-500",
  },
]

export default function ImpactoPage() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        <AnimatedBackground variant="impact" />

        <div className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h1 className="font-heading font-bold text-4xl md:text-6xl text-white mb-6">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Tecnologia com propósito.
              </span>{" "}
              <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
                Educação com significado.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed">
              Transformando vidas através da educação inovadora em toda a América Latina
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {impactMetrics.map((metric, index) => {
              const Icon = metric.icon
              return (
                <div
                  key={index}
                  className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:scale-105 transition-all duration-300 hover:border-slate-400/50"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity`}
                  />

                  {/* Ícone + número alinhados */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${metric.color}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <p className="text-3xl font-heading font-bold text-white">{metric.value}</p>
                  </div>

                  <p className="text-sm text-slate-400">{metric.label}</p>
                </div>
              )
            })}
          </div>

          <div className="max-w-3xl mx-auto mb-20">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-center mb-12">
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Vozes que Inspiram
              </span>
            </h2>
            <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl shadow-2xl p-8 md:p-12 backdrop-blur-xl">
              {/* Floating icons around testimonial */}
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center animate-bounce">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div
                className="absolute -bottom-3 left-1/4 w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center animate-bounce"
                style={{ animationDelay: "0.2s" }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-full blur-lg opacity-50 animate-pulse" />
                  <img
                    src={testimonials[currentTestimonial].image || "/placeholder.svg"}
                    alt={testimonials[currentTestimonial].name}
                    className="relative w-24 h-24 rounded-full object-cover border-4 border-slate-700"
                  />
                </div>
                <p className="text-lg md:text-xl text-slate-200 leading-relaxed mb-6 italic">
                  "{testimonials[currentTestimonial].text}"
                </p>
                <div>
                  <p className="font-heading font-bold text-xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    {testimonials[currentTestimonial].name}
                  </p>
                  <p className="text-slate-300 font-medium">{testimonials[currentTestimonial].role}</p>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prevTestimonial}
                  className="rounded-full bg-slate-700/50 border-slate-600 hover:border-cyan-400 hover:bg-cyan-400/20 text-slate-300 hover:text-cyan-400 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextTestimonial}
                  className="rounded-full bg-slate-700/50 border-slate-600 hover:border-cyan-400 hover:bg-cyan-400/20 text-slate-300 hover:text-cyan-400 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex justify-center gap-2 mt-4">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentTestimonial
                        ? "bg-gradient-to-r from-cyan-400 to-blue-400 w-8"
                        : "bg-slate-600 w-2"
                    }`}
                  />
                ))}
              </div>
            </div>

                <VideoTestimonialsCarousel />


          </div>

          <div className="mb-20">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-center mb-12">
              <span className="bg-gradient-to-r from-orange-400 via-yellow-400 to-green-400 bg-clip-text text-transparent">
                Momentos de Transformação
              </span>
            </h2>
            <div className="relative overflow-hidden">
              <div className="flex gap-8 animate-scroll-left">
                {/* Duplicar array para criar loop infinito */}
                {[...photos, ...photos].map((photo, index) => (
                  <div key={index} className="flex-shrink-0 w-80 md:w-96 group">
                    <div
                      className={`relative rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700 hover:border-transparent transition-all group-hover:scale-105`}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${photo.color} opacity-0 group-hover:opacity-20 transition-opacity z-10`}
                      />
                      <img
                        src={photo.src || "/placeholder.svg"}
                        alt={photo.alt}
                        className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-transparent p-4">
                        <p className="text-white font-medium text-sm">{photo.alt}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl shadow-2xl p-8 md:p-12 backdrop-blur-xl overflow-hidden">
              {/* Floating icons around map */}
              <div className="absolute top-8 right-8 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center animate-bounce">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div className="absolute bottom-8 left-8 w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center animate-pulse">
                <MapPin className="w-6 h-6 text-white" />
              </div>

              <h2 className="font-heading font-bold text-2xl md:text-3xl text-center mb-8">
                <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Nossa Presença na América Latina
                </span>
              </h2>
              <div className="relative h-96 bg-slate-700/30 rounded-xl flex items-center justify-center border-2 border-slate-700/50 overflow-hidden group">
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 group-hover:bg-slate-900/60 transition-colors">
                  <div className="text-center">
                    <div className="relative inline-block mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full blur-xl opacity-50 animate-pulse" />
                      <MapPin className="relative w-16 h-16 text-cyan-400" />
                    </div>
                    <p className="text-2xl font-heading font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                      Presente em 3 países
                    </p>
                    <p className="text-slate-300 text-lg">Uma visão Global</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
