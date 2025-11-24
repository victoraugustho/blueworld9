"use client"

import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedBackground } from "./animated-background"

export function ProjectsSection() {
  const projects = [
    {
      title: "Robótica Educacional",
      description: "Projetos práticos com robôs programáveis que ensinam lógica, engenharia e design thinking.",
      technologies: ["Robótica", "Arduino", "IoT"],
      image: "/project-01.png",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: "Desenvolvimento Web",
      description: "Estudantes criam aplicações web reais com HTML, CSS, JavaScript e frameworks modernos.",
      technologies: ["Web", "JavaScript", "React"],
      image: "/project-02.png",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: "Games e Animação",
      description: "Criação de jogos e animações interativas que combinam criatividade, lógica e narrativa.",
      technologies: ["Games", "Animação", "Criatividade"],
      image: "/project-03.png",
      gradient: "from-orange-500 to-red-500",
    },
    {
      title: "IA e Machine Learning",
      description: "Introdução prática a inteligência artificial através de projetos desafiadores e acessíveis.",
      technologies: ["IA", "Python", "Machine Learning"],
      image: "/project-04.png",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: "Soluções Sociais",
      description: "Projetos que usam tecnologia para resolver problemas reais da comunidade e sociedade.",
      technologies: ["Social", "Impacto", "Comunidade"],
      image: "/project-05.png",
      gradient: "from-yellow-500 to-orange-500",
    },
    {
      title: "Maker Space",
      description: "Ambiente colaborativo onde alunos prototipam ideias, desde conceito até implementação prática.",
      technologies: ["Maker", "3D", "Prototipagem"],
      image: "/project-06.png",
      gradient: "from-pink-500 to-rose-500",
    },
  ]

  return (
    <section className="relative py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <AnimatedBackground variant="projects" />
      <div className="container mx-auto px-6 relative z-10 max-w-300">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-full backdrop-blur">
            <p className="text-sm font-semibold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              NOSSOS PROJETOS
            </p>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Projetos que{" "}
            <span className="text-white/90">
              Inspiram e Transformam
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Conheça os projetos de inovação que nossos alunos desenvolvem, combinando criatividade, tecnologia e impacto
            social.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl bg-slate-900 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-slate-700"
            >
              <div className={`relative h-48 overflow-hidden bg-gradient-to-br ${project.gradient}`}>
                <img
                  src={project.image || "/placeholder.svg"}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 group-hover:opacity-100"
                />
              </div>

              <div className="p-6">
                <h3 className="font-heading text-xl font-bold text-white mb-2">{project.title}</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">{project.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {project.technologies.map((tech, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 bg-gradient-to-r ${project.gradient} text-white text-xs font-semibold rounded-full`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className={`w-full bg-gradient-to-r ${project.gradient} text-white border-0 hover:opacity-90 transition-all duration-300`}
                >
                  Saiba Mais
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
