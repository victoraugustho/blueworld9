"use client"

import { Button } from "@/components/ui/button"
import { Instagram, Linkedin, Youtube, Mail, Phone, MapPin, Heart } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function Footer() {
  
  const router = useRouter()
  const scrollToContact = () => {
  const isHome = window.location.pathname === "/"

  if (isHome) {
    // Já está na página certa → faz scroll suave
    const element = document.getElementById("contato")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  } else {
    // Não está na home → redireciona para lá com hash
    router.push("/#contato")
  }
}

  return (
    <footer className="relative bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white py-16 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand Section */}
            <div data-aos="fade-right" className="md:col-span-2 space-y-6">
              <div className="flex items-center justify-center">
                <Link href="/"><Image
                  src="/webp/logo-branca-bw9.webp"
                  alt="BlueWorld9"
                  width={220}
                  height={180}
                  className="object-contain"
                /></Link>
              </div>
              <p className="text-white/70 leading-relaxed max-w-md">
                Transformamos a Educação com Tecnologia, Inovação e Metodologias Humanizadas. Preparamos nossos alunos para os desafios do futuro, integrando o STEAM, a Robótica e os pilares da Educação 5.0.
              </p>
              <div className="flex gap-3">
                <a
                  href="https://www.instagram.com/blueworld9_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <Instagram className="w-5 h-5 text-white" />
                </a>
                <a
                  href="https://www.youtube.com/@BW9Global"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                >
                  <Youtube className="w-5 h-5 text-white" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div data-aos="fade-up">
              <h4 className="font-heading font-bold text-lg mb-4 text-cyan-400">Links Rápidos</h4>
              <ul className="space-y-3">
                <li>
                  <a href="/" className="text-white/70 hover:text-cyan-400 transition-colors">
                    Início
                  </a>
                </li>
                <li>
                  <a href="/sobre" className="text-white/70 hover:text-cyan-400 transition-colors">
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="/para-escolas" className="text-white/70 hover:text-cyan-400 transition-colors">
                    Para Escolas
                  </a>
                </li>
                <li>
                  <a href="/equipe" className="text-white/70 hover:text-cyan-400 transition-colors">
                    Equipe
                  </a>
                </li>
                <li>
                  <a href="/impacto" className="text-white/70 hover:text-cyan-400 transition-colors">
                    Impacto
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div data-aos="fade-left">
              <h4 className="font-heading font-bold text-lg mb-4 text-orange-400">Contato</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-white/70">
                  <Mail className="w-4 h-4 mt-1 text-cyan-400 flex-shrink-0" />
                  <a href="mailto:contato@bw9global.com" className="hover:text-cyan-400 transition-colors text-sm">
                    contato@bw9global.com
                  </a>
                </li>
                <li className="flex items-start gap-2 text-white/70">
                  <Phone className="w-4 h-4 mt-1 text-orange-400 flex-shrink-0" />
                  <a href="https://wa.me/556292752970" target="_blank" className="hover:text-orange-400 transition-colors text-sm">
                    +55 (62) 9275-2970
                  </a>
                </li>
                <li className="flex items-start gap-2 text-white/70">
                  <MapPin className="w-4 h-4 mt-1 text-purple-400 flex-shrink-0" />
                  <span className="text-sm">América Latina</span>
                </li>
              </ul>
            </div>
          </div>

          {/* CTA Section */}
          <div data-aos="fade-left" className="py-12 border-t border-b border-white/10 my-8">
            <div className="text-center space-y-6">
              <h3 className="font-heading font-bold text-2xl md:text-3xl bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Pronto para Transformar a Educação?
              </h3>
              <p className="text-white/70 max-w-2xl mx-auto">
                A Blue World 9 acredita que a educação do futuro é feita com inovação, sensibilidade e propósito.
              </p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-lg px-8 shadow-lg hover:shadow-orange-500/50 transition-all"
                onClick={scrollToContact}
              >
                Leve a Educação 5.0 para sua escola
              </Button>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-white/60 text-sm text-center md:text-left">
                © 2025 Blue World 9 – Soluções Educacionais. Todos os direitos reservados.
              </p>
              <p className="flex items-center gap-2 text-white/60 text-sm">
                Feito com <Heart className="w-4 h-4 text-red-400 fill-red-400" /> por{" "}
                <a href="https://autonextech.com.br" className="text-cyan-600">
                  AutoNex
                </a>{" "}
                para a educação do futuro
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
