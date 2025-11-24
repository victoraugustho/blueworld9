"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

const testimonials = [
  {
    name: "Maria Silva",
    role: "Diretora Pedagógica",
    school: "Colégio Inovação",
    text: "A Blue World 9 transformou completamente nossa abordagem educacional. Os alunos estão mais engajados e criativos do que nunca.",
    image: "/professional-woman-educator.jpg",
  },
  {
    name: "João Santos",
    role: "Professor de Tecnologia",
    school: "Escola do Futuro",
    text: "O suporte pedagógico e técnico é excepcional. Conseguimos implementar projetos maker que realmente fazem diferença na vida dos estudantes.",
    image: "/male-teacher-technology.jpg",
  },
  {
    name: "Ana Costa",
    role: "Coordenadora STEAM",
    school: "Instituto Educacional",
    text: "A formação docente oferecida pela Blue World 9 nos preparou para liderar a transformação digital na educação com confiança e propósito.",
    image: "/female-coordinator-education.jpg",
  },
]

export function ImpactSection() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <section id="impacto" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-primary mb-6">
            Tecnologia com propósito. Educação com significado.
          </h2>
        </div>

        {/* Testimonials Carousel */}
        <div className="max-w-3xl mx-auto mb-20">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 relative">
            <div className="flex flex-col items-center text-center">
              <img
                src={testimonials[currentTestimonial].image || "/placeholder.svg"}
                alt={testimonials[currentTestimonial].name}
                className="w-20 h-20 rounded-full object-cover mb-6"
              />
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed mb-6 italic">
                "{testimonials[currentTestimonial].text}"
              </p>
              <div>
                <p className="font-heading font-bold text-lg text-primary">{testimonials[currentTestimonial].name}</p>
                <p className="text-foreground/60">{testimonials[currentTestimonial].role}</p>
                <p className="text-foreground/60 text-sm">{testimonials[currentTestimonial].school}</p>
              </div>
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <Button variant="outline" size="icon" onClick={prevTestimonial} className="rounded-full bg-transparent">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextTestimonial} className="rounded-full bg-transparent">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex justify-center gap-2 mt-4">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentTestimonial ? "bg-primary w-8" : "bg-primary/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Photos Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <img
              src="/students-working-with-robotics-in-maker-space.jpg"
              alt="Alunos trabalhando com robótica"
              className="w-full h-64 object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <img
              src="/teacher-guiding-students-in-steam-activities.jpg"
              alt="Professor orientando atividades STEAM"
              className="w-full h-64 object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <img
              src="/students-presenting-technology-project.jpg"
              alt="Alunos apresentando projeto"
              className="w-full h-64 object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>

        {/* Map */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h3 className="font-heading font-bold text-2xl md:text-3xl text-primary text-center mb-8">
              Nossa Presença na América Latina
            </h3>
            <div className="relative h-96 bg-muted/30 rounded-xl flex items-center justify-center">
              <img
                src="/latin-america-map-with-location-markers.jpg"
                alt="Mapa da América Latina"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-primary mx-auto mb-4" />
                  <p className="text-xl font-heading font-bold text-primary">Presente em diversos países</p>
                  <p className="text-foreground/60">Transformando a educação em toda a região</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
