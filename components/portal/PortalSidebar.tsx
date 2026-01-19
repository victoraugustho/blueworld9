"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BookOpen, FileText, LogOut, ShieldCheck, Menu, X, Users, Bell } from "lucide-react"
import { useState } from "react"

type Locale = "pt-BR" | "es"

export function PortalSidebar({ isAdmin, locale }: { isAdmin: boolean; locale: Locale }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const t = {
    title: locale === "es" ? "Portal del Profesor" : "Portal do Professor",
    adminSection: locale === "es" ? "Administración" : "Administração",
    logout: locale === "es" ? "Salir" : "Sair",
    menu: {
      home: locale === "es" ? "Inicio" : "Início",
      aulas: locale === "es" ? "Clases" : "Aulas",
      materiais: locale === "es" ? "Materiales" : "Materiais",
      notificacoes: locale === "es" ? "Notificaciones" : "Notificações",
      adminMaterials: locale === "es" ? "Materiales (Admin)" : "Materiais (Admin)",
      teachers: locale === "es" ? "Profesores" : "Professores",
      adminNotifications: locale === "es" ? "Notificaciones (Admin)" : "Notificações (Admin)",
    },
  }

  const teacherMenu = [
    { href: "/portal/dashboard", label: t.menu.home, icon: Home },
    { href: "/portal/dashboard/aulas", label: t.menu.aulas, icon: BookOpen },
    { href: "/portal/dashboard/materiais", label: t.menu.materiais, icon: FileText },
    { href: "/portal/dashboard/notificacoes", label: t.menu.notificacoes, icon: Bell },
  ]

  const adminMenu = [
    { href: "/portal/dashboard/admin/materials", label: t.menu.adminMaterials, icon: ShieldCheck },
    { href: "/portal/dashboard/admin/teachers", label: t.menu.teachers, icon: Users },
    { href: "/portal/dashboard/admin/notifications", label: t.menu.adminNotifications, icon: Bell },
  ]

  return (
    <>
      {/* BOTÃO MOBILE */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl 
        bg-white/10 backdrop-blur-md border border-white/20 text-white"
        aria-label="Menu"
      >
        {open ? <X /> : <Menu />}
      </button>

      {/* SIDEBAR */}
      <aside
        className={`
          fixed z-40
          top-6 left-4
          w-72 h-[calc(100vh-3rem)]
          transform transition-all duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-[300px] md:translate-x-0"}

          bg-cyan-800/10 backdrop-blur-2xl
          border border-white/20
          rounded-2xl shadow-2xl shadow-black/20

          flex flex-col p-6
        `}
      >
        <h2 className="text-xl font-semibold text-white mb-8 tracking-wide">{t.title}</h2>

        {/* MENU DO PROFESSOR */}
        <nav className="flex flex-col gap-2 flex-1">
          {teacherMenu.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + "/")

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-300
                  ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 shadow-md shadow-cyan-500/10"
                      : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}

          {/* SEÇÃO DE ADMIN */}
          {isAdmin && (
            <>
              <div className="my-4 border-t border-white/20" />

              <h3 className="text-xs uppercase tracking-wider text-white/50 mb-2 pl-2">
                {t.adminSection}
              </h3>

              {adminMenu.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(item.href + "/")

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-300
                      ${
                        active
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/20 shadow-md shadow-purple-500/10"
                          : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* LOGOUT */}
        <form action="/api/portal/logout" method="POST" className="mt-auto pt-4 border-t border-white/20">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
            bg-red-800/50 text-red-300 border border-red-500/20
            hover:bg-red-900/60 hover:shadow-md hover:shadow-red-500/10 
            transition-all"
          >
            <LogOut className="w-5 h-5" />
            {t.logout}
          </button>
        </form>
      </aside>
    </>
  )
}
