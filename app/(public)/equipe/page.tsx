"use client"

import { AnimatedBackground } from "@/components/animated-background"
import { Linkedin, Mail, Github, Phone } from "lucide-react"
import Image from "next/image"
import { Footer } from "@/components/footer"

export default function EquipePage() {
  const teamMembers = [
    {
      name: "Cleomar di Castro",
      role: "CEO e Fundador da Blue World 9",
      formacao: "",
      bio: "Como CEO e Fundador da Blue World 9 Soluções Educacionais, Cleomar di Castro é a força motriz por trás da missão da empresa. Ele lidera a estratégia de crescimento e inovação, garantindo que a Blue World 9 permaneça na vanguarda do ensino. Sua visão é dedicada a inspirar a equipe e a elevar o padrão dos programas educacionais, redefinindo o sucesso no aprendizado em todo o mundo.",
      image: "/webp/cleomar.webp",
      color: "from-cyan-500 to-blue-600",
      social: {
        Phone: "5562993204235",
        email: "ana.silva@blueworld9.com",
      },
    },
    {
      name: "Diogo Oliveira",
      role: "Diretor de Educação e Tecnologia Global",
      formacao:"Graduado em Direito e Pedagogia, com especializações em Pedagogia Empresarial, Supervisão Educacional, Robótica Educacional, Psicopedagogia Clínica e Institucional, e Docência Universitária.",
      bio: "Com uma sólida formação jurídica e pedagógica, sua direção conecta a excelência educacional à vanguarda da tecnologia na Blue World 9. Ele lidera a estratégia de ensino e inovação de programas, garantindo que a união entre pedagogia de alta performance e ferramentas tecnológicas impulsione a aprendizagem e o crescimento da empresa.",
      image: "/webp/diogo.webp",
      color: "from-purple-500 to-pink-600",
      social: {
        email: "carlos.santos@blueworld9.com",
      },
    },
    {
      name: "Ricardo Oliveira",
      role: "Coordenador de Tecnologia e Suporte Educacional",
      formacao:"Tecnólogo em Informática para Internet.",
      bio: "Com sólida formação técnica, sua atuação lidera a padronização e a qualidade dos processos tecnológicos em todas as unidades da Blue World 9 (nacionais e internacionais). Sua função principal é capacitar a equipe, atuando no treinamento técnico e pedagógico dos professores para assegurar a excelência e o alto desempenho de toda a rede global.",
      image: "/webp/ricardo.webp",
      color: "from-orange-500 to-rose-600",
      social: {
        email: "mariana.costa@blueworld9.com",
      },
    },
    {
      name: "Alexandra Castro",
      role: "Coordenadora Pedagógica Nacional",
      formacao:"Graduada em Pedagogia",
      bio: "Como a líder da excelência educacional, sua atuação lidera a coordenação pedagógica nacional da Blue World 9 Soluções Educacionais. Sua missão foca em potencializar o corpo docente e em garantir o alto padrão de qualidade e consistência dos programas, transformando o processo de aprendizado em cada unidade parceira no país.",
      image: "/webp/alexandra.webp",
      color: "from-green-500 to-emerald-600",
      social: {
        email: "rafael.oliveira@blueworld9.com",
      },
    },
    {
      name: "Daniella Alquimim",
      role: "Coordenadora Pedagógica Internacional",
      formacao:"Graduada em Letras (Português/Inglês) e Pedagogia, com especializações em Espanhol e Educação Ambiental.",
      bio: "Com sua formação ampla e global, sua atuação lidera a coordenação pedagógica das unidades internacionais da Blue World 9. Sua missão foca em garantir o alinhamento pedagógico e a qualidade educacional das operações externas, dedicando-se ao acompanhamento docente e à orientação estratégica fora do Brasil.",
      image: "/webp/daniella.webp",
      color: "from-green-500 to-emerald-600",
      social: {
        email: "rafael.oliveira@blueworld9.com",
      },
    },
    {
      name: "Renato Borges",
      role: "Diretor Administrativo e de Negócios Global",
      formacao:"Administrador de Empresas com especialização em Gestão Operacional e Comercial.",
      bio: "Com uma visão 360º, sua direção é responsável por toda a estrutura administrativa e comercial da Blue World 9. Ele integra e gere as operações, garantindo o alto padrão de estratégia de vendas, gestão financeira e eficiência administrativa para um crescimento sólido e de excelência em nível nacional e internacional.",
      image: "/webp/renato.webp",
      color: "from-yellow-500 to-orange-600",
      social: {
        email: "julia.mendes@blueworld9.com",
      },
    },
  ]

  return (
    <main className="min-h-screen">
      <section className="relative py-20 md:py-42 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        <AnimatedBackground variant="impact" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div data-aos="fade-up" className="text-center mb-16">
              <h1 className="font-heading font-bold text-4xl md:text-6xl bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
                Nossa Equipe
              </h1>
              <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-3xl mx-auto">
                Conheça nossa equipe de especialistas dedicados que tornam a transformação educacional uma realidade. Somos um time multidisciplinar, unido pela paixão por educar e pela busca incessante pela inovação.
              </p>
            </div>

            {/* Team Grid */}
            <div data-aos="fade-down" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 px-10 sm:px-0">
              {teamMembers.map((member, index) => (
                <div
                  key={index}
                  className="group relative bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl"
                >
                  {/* Gradient overlay on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${member.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                  />

                  {/* Image */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${member.color} opacity-20`} />

                    <Image
                        src={member.image || "/placeholder.svg"}
                        alt={member.name}
                        fill
                        sizes="(max-width: 768px) 100vw,
                            (max-width: 1200px) 50vw,
                            33vw"
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-110"
                    />
                </div>


                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-heading font-bold text-xl text-white mb-1">{member.name}</h3>
                    <p
                      className={`text-sm font-semibold bg-gradient-to-r ${member.color} bg-clip-text text-transparent mb-3`}
                    >
                      {member.role}
                    </p>
                    <p className="text-white/70 text-sm leading-relaxed mb-4">{member.formacao}</p>
                    <p className="text-white/70 text-sm leading-relaxed mb-4">{member.bio}</p>

                    {/* Social Links */}
                    <div className="flex gap-3">
                      {member.social.Phone && (
                        <a
                          href={member.social.Phone}
                          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 flex items-center justify-center transition-all group/icon"
                          aria-label="WhatsApp"
                        >
                          <Phone className="w-4 h-4 text-white/60 group-hover/icon:text-cyan-400 transition-colors" />
                        </a>
                      )}
                      {/*member.social.github && (
                        <a
                          href={member.social.github}
                          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 flex items-center justify-center transition-all group/icon"
                          aria-label="GitHub"
                        >
                          <Github className="w-4 h-4 text-white/60 group-hover/icon:text-purple-400 transition-colors" />
                        </a>
                      )*/}
                      {member.social.email && (
                        <a
                          href={`mailto:${member.social.email}`}
                          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-400/50 flex items-center justify-center transition-all group/icon"
                          aria-label="Email"
                        >
                          <Mail className="w-4 h-4 text-white/60 group-hover/icon:text-orange-400 transition-colors" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Section */}
            <div data-aos="fade-up" className="mt-20 text-center">
              <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12">
                <h2 className="font-heading font-bold text-2xl md:text-4xl text-white mb-4">
                  Quer fazer parte da equipe?
                </h2>
                <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">
                  Estamos sempre em busca de pessoas talentosas e apaixonadas por educação. Entre em contato e venha
                  transformar o futuro conosco!
                </p>
                <a
                  href="mailto:contato@bw9global.com"
                  className="inline-block px-8 py-4 rounded-full font-semibold text-white 
                    bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600
                    hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700
                    transition-all duration-500 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Envie seu currículo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
