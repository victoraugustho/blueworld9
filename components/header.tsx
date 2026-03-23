import { Home, Globe, School, Info, Users, Menu } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

const menuItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Globe, label: "Impacto", href: "/impacto" },
  { icon: School, label: "Para Escolas", href: "/para-escolas" },
  { icon: Users, label: "Equipe", href: "/equipe" },
  { icon: Info, label: "Sobre", href: "/sobre" },
]

const portalDomain = process.env.NEXT_PUBLIC_PORTAL_DOMAIN || "https://portal.bw9global.com"

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {menuItems.map((item) => {
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`glassmorphic-nav-item ${mobile ? "w-full" : ""}`}
          >
            <Icon className="w-5 h-5 text-white transition-transform duration-200 hover:scale-110" />
            <span className="text-white font-medium">{item.label}</span>
          </Link>
        )
      })}
    </>
  )
}

export function GlassmorphismNav() {
  return (
    <header
      className="
        fixed top-0 left-0 right-0 z-50
        px-4 sm:px-2 lg:px-8 pt-4 sm:pt-6
      "
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-2 lg:px-8 py-3 sm:py-4 rounded-xl lg:rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xl sm:text-sm">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Image
                src="/webp/logo-branca-bw9-extends.webp"
                alt="BlueWorld9"
                width={180}
                height={80}
                className="object-contain mr-10"
              />
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-2 sm:px-2">
            <NavLinks />
          </div>

          <div className="hidden lg:flex items-center">
            <Link
              href="/#contato"
              className="relative px-6 py-2 mr-4 rounded-full font-semibold text-white border hover:bg-white hover:text-blue-500 transition-all duration-800 hover:scale-[1.03]"
            >
              <span className="relative z-10">Contato</span>
            </Link>

            <a
              href={portalDomain}
              className="relative px-6 py-2 rounded-full font-semibold text-white bg-gradient-to-r from-orange-500 to-rose-400 hover:from-emerald-400 hover:via-cyan-400 hover:to-blue-500 transition-all duration-800 hover:scale-[1.03] hover:border-2"
            >
              <span className="relative z-10">Acessar Portal</span>
            </a>
          </div>

          <details className="lg:hidden">
            <summary
              className="list-none lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer [&::-webkit-details-marker]:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6 text-white" />
            </summary>

            <div className="absolute left-4 right-4 mt-4 pt-4 border-t border-white/20 rounded-xl bg-slate-900/90 backdrop-blur-xl p-4 shadow-2xl">
              <div className="flex flex-col gap-2">
                <NavLinks mobile />
              </div>

              <div className="pt-4 border-t border-white/20 mt-4 flex flex-wrap gap-3">
                <a
                  href={portalDomain}
                  className="relative px-6 py-2 rounded-full font-semibold text-white bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 hover:from-emerald-400 hover:via-cyan-400 hover:to-blue-500 transition-all duration-800 hover:scale-[1.03]"
                >
                  <span className="relative z-10">Acessar Portal</span>
                </a>

                <Link
                  href="/#contato"
                  className="relative px-6 py-2 rounded-full font-semibold text-white border hover:bg-white hover:text-blue-500 transition-all duration-800 hover:scale-[1.03]"
                >
                  <span className="relative z-10">Contato</span>
                </Link>
              </div>
            </div>
          </details>
        </nav>
      </div>
    </header>
  )
}
