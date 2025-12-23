"use client"

import { Home, Globe, School, Info, Users, X, Menu } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"


export function GlassmorphismNav() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showNav, setShowNav] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const pathname = usePathname()


  const menuItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Globe, label: "Impacto", href: "/impacto" },
    { icon: School, label: "Para Escolas", href: "/para-escolas" },
    { icon: Users, label: "Equipe", href: "/equipe" },
    { icon: Info, label: "Sobre", href: "/sobre" },
  ]

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

  


  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY

      if (currentScroll > lastScrollY && currentScroll > 620) {
        setShowNav(false)
      } 
      else {
        setShowNav(true)
      }

      setLastScrollY(currentScroll)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50 transition-transform duration-300
        px-4 sm:px-2 lg:px-8 pt-4 sm:pt-6
        ${showNav ? "md:translate-y-0" : "md:-translate-y-full"}
      `}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-2 lg:px-8 py-3 sm:py-4 rounded-xl lg:rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xl sm:text-sm">
        <nav className="flex items-center justify-between">

          {/* LOGO */}
          <div className="flex items-center gap-2">
            <Link href="/"><Image
              src="/webp/logo-branca-bw9-extends.webp"
              alt="BlueWorld9"
              width={180}
              height={80}
              className="object-contain mr-10"
            /></Link>
          </div>

          {/* DESKTOP MENU */}
          <div className="hidden lg:flex items-center gap-2 sm:px-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={index}
                  href={item.href}
                  className={`glassmorphic-nav-item ${isActive ? "glassmorphic-nav-item-active" : ""}`}
                >
                  <Icon className="w-5 h-5 text-white transition-transform duration-200 hover:scale-110" />
                  <span className="text-white font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* BOTÃO DE AÇÃO - DESKTOP */}
          <div className="hidden lg:flex items-center">
            <button className="relative px-6 py-2 mr-4 rounded-full font-semibold text-white border hover:bg-white hover:text-blue-500
              transition-all duration-800 hover:scale-[1.03]"
              onClick={scrollToContact}>
            <span className="relative z-10">Contato</span>
            </button>
            <button className="relative px-6 py-2 rounded-full font-semibold text-white 
                bg-gradient-to-r from-orange-500 to-rose-400
                hover:from-emerald-400 hover:via-cyan-400 hover:to-blue-500
                transition-all duration-800 hover:scale-[1.03] hover:border-2"
                onClick={() => window.location.href = "/portal/login"}
                >
              <span className="relative z-10">Acessar Portal</span>
            </button>
          </div>

          {/* BOTÃO MOBILE */}
          <button
            className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
          </button>

        </nav>

        {/* MENU MOBILE */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-white/20">
            <div className="flex flex-col gap-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`glassmorphic-nav-item ${isActive ? "glassmorphic-nav-item-active" : ""}`}
                  >
                    <Icon className="w-5 h-5 text-white transition-transform duration-200" />
                    <span className="text-white font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
            <div className="pt-4 border-t border-white/20 mt-4">
            <button className="relative px-6 py-2 rounded-full font-semibold text-white 
              bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600
              hover:from-emerald-400 hover:via-cyan-400 hover:to-blue-500
              transition-all duration-800 hover:scale-[1.03] md:text-yellow"
              onClick={() => window.location.href = "/portal/login"}
            >
              <span className="relative z-10">Acessar Portal</span>
            </button>

            <button className="relative px-6 py-2 ml-4 rounded-full font-semibold text-white border hover:bg-white hover:text-blue-500
              transition-all duration-800 hover:scale-[1.03] cursor pointer"
              onClick={scrollToContact}
              >
            <span className="relative z-10">Contato</span>
            </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
