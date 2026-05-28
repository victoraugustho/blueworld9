"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Home,
  BookOpen,
  FileText,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Users,
  Bell,
  ClipboardList,
  Sparkles,
  UserRound,
  ChevronDown,
  CalendarDays,
  Bug,
  GraduationCap,
  FolderKanban,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

type Locale = "pt-BR" | "es"

type TeacherMini = {
  name: string
  avatarUrl?: string | null
}

const SIDEBAR_COLLAPSE_KEY = "bw9:sidebar:collapsed"

export function PortalSidebar({
  isAdmin,
  canAccessRestrictedAdminAreas,
  canAccessProjectsAdminArea,
  locale,
  teacher,
  systemVersion,
  logoSrc = "/webp/logo-branca-bw9.webp", // garanta que exista em /public ou altere
}: {
  isAdmin: boolean
  canAccessRestrictedAdminAreas: boolean
  canAccessProjectsAdminArea: boolean
  locale: Locale
  teacher?: TeacherMini
  systemVersion?: string
  logoSrc?: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadLoading, setUnreadLoading] = useState(false)
  const [pendingRelationsCount, setPendingRelationsCount] = useState(0)
  const [pendingRelationsLoading, setPendingRelationsLoading] = useState(false)

  const sidebarRef = useRef<HTMLElement | null>(null)
  const profileRef = useRef<HTMLDivElement | null>(null)

  const t = {
    adminSection: locale === "es" ? "Administraci\u00f3n" : "Administra\u00e7\u00e3o",
    logout: locale === "es" ? "Salir" : "Sair",
    profile: locale === "es" ? "Perfil" : "Perfil",
    menu: {
      home: locale === "es" ? "Inicio" : "In\u00edcio",
      aulas: locale === "es" ? "Clases" : "Aulas",
      agenda: locale === "es" ? "Agenda + Notas" : "Agenda + Notas",
      materiais: locale === "es" ? "Materiales" : "Materiais",
      projetos: locale === "es" ? "Proyectos" : "Projetos",
      notas: locale === "es" ? "Notas" : "Notas",
      notificacoes: locale === "es" ? "Notificaciones" : "Notifica\u00e7\u00f5es",
      reportBug: locale === "es" ? "Reportar problema" : "Relatar problema",
      adminMaterials: locale === "es" ? "Materiales (Admin)" : "Materiais (Admin)",
      adminBlog: locale === "es" ? "Blog (Admin)" : "Blog (Admin)",
      adminProjects: locale === "es" ? "Proyectos (Admin)" : "Projetos (Admin)",
      adminTurmas: locale === "es" ? "Categorias/Turmas" : "Categorias/Turmas",
      teachers: locale === "es" ? "Profesores" : "Professores",
      adminSchedules: locale === "es" ? "Agenda de Profesores" : "Agenda de Professores",
      adminAgenda: locale === "es" ? "Agenda de Coordinadores" : "Agenda de Coordenadores",
      technicalScheduling: locale === "es" ? "Agendamiento Tecnico" : "Agendamento Tecnico",
      adminNotifications: locale === "es" ? "Notificaciones (Admin)" : "Notifica\u00e7\u00f5es (Admin)",
      bugReports: locale === "es" ? "Relaciones" : "Rela\u00e7\u00f5es",
      logs: locale === "es" ? "Auditoria" : "Auditoria",
      ai: locale === "es" ? "IA" : "IA",
    },
  }

  const teacherMenu = useMemo(
    () => [
      { href: "/portal/dashboard", label: t.menu.home, icon: Home },
      { href: "/portal/dashboard/aulas", label: t.menu.aulas, icon: BookOpen },
      { href: "/portal/dashboard/notas/lancamentos", label: t.menu.agenda, icon: CalendarDays },
      { href: "/portal/dashboard/materiais", label: t.menu.materiais, icon: FileText },
      { href: "/portal/dashboard/projetos", label: t.menu.projetos, icon: FolderKanban },
      { href: "/portal/dashboard/ia", label: t.menu.ai, icon: Sparkles },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  )

  const adminMenu = useMemo(
    () => {
      const items: { href: string; label: string; icon: any }[] = []

      if (isAdmin) {
        items.push(
          { href: "/portal/dashboard/admin/materials", label: t.menu.adminMaterials, icon: ShieldCheck },
          { href: "/portal/dashboard/admin/turmas", label: t.menu.adminTurmas, icon: GraduationCap },
          { href: "/portal/dashboard/admin/teachers", label: t.menu.teachers, icon: Users },
          { href: "/portal/dashboard/admin/schedules", label: t.menu.adminSchedules, icon: CalendarDays },
          { href: "/portal/dashboard/admin/agenda", label: t.menu.adminAgenda, icon: CalendarDays },
          { href: "/portal/dashboard/admin/agendamento-tecnico", label: t.menu.technicalScheduling, icon: CalendarDays },
          { href: "/portal/dashboard/admin/notifications", label: t.menu.adminNotifications, icon: Bell },
          { href: "/portal/dashboard/admin/logs", label: t.menu.logs, icon: ClipboardList }
        )

        if (canAccessRestrictedAdminAreas) {
          items.splice(1, 0, { href: "/portal/dashboard/admin/blog", label: t.menu.adminBlog, icon: FileText })
          items.splice(items.length - 1, 0, {
            href: "/portal/dashboard/admin/bug-reports",
            label: t.menu.bugReports,
            icon: Bug,
          })
        }

        if (canAccessProjectsAdminArea) {
          items.splice(2, 0, { href: "/portal/dashboard/admin/projetos", label: t.menu.adminProjects, icon: FolderKanban })
        }
      }

      return items
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, isAdmin, canAccessRestrictedAdminAreas, canAccessProjectsAdminArea]
  )

  // ✅ corrige active do "In\u00edcio" (só ativo quando for exatamente /portal/dashboard)
  function isActive(href: string) {
    if (href === "/portal/dashboard") return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
      if (saved === "1") {
        setCollapsed(true)
      }
    } catch {
      // ignore localStorage issues
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0")
    } catch {
      // ignore localStorage issues
    }
    document.documentElement.style.setProperty("--portal-sidebar-width", collapsed ? "104px" : "320px")
  }, [collapsed])

  // Fechar sidebar (mobile) ao clicar fora
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return
      const el = sidebarRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Fechar dropdown do perfil ao clicar fora
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!profileOpen) return
      const el = profileRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [profileOpen])

  // Quando navegar (pathname muda), fecha tudo
  useEffect(() => {
    setOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    setAvatarError(false)
  }, [teacher?.avatarUrl])

  useEffect(() => {
    let active = true
    async function loadUnread() {
      setUnreadLoading(true)
      try {
        const res = await fetch("/api/portal/notifications/unread", { cache: "no-store" })
        const data = await res.json().catch(() => null)
        if (!active) return
        setUnreadCount(Number(data?.unread ?? 0))
      } catch {
        if (!active) return
        setUnreadCount(0)
      } finally {
        if (active) setUnreadLoading(false)
      }
    }
    loadUnread()
    return () => {
      active = false
    }
  }, [pathname])

  useEffect(() => {
    let active = true
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function loadPendingRelations() {
      if (!isAdmin || !canAccessRestrictedAdminAreas) {
        setPendingRelationsCount(0)
        return
      }

      setPendingRelationsLoading(true)
      try {
        const res = await fetch("/api/admin/bug-reports?summary=1", { cache: "no-store" })
        const data = await res.json().catch(() => null)
        if (!active) return
        setPendingRelationsCount(Number(data?.pending ?? 0))
      } catch {
        if (!active) return
        setPendingRelationsCount(0)
      } finally {
        if (active) setPendingRelationsLoading(false)
      }
    }
    loadPendingRelations()
    intervalId = setInterval(loadPendingRelations, 30000)
    return () => {
      active = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [isAdmin, canAccessRestrictedAdminAreas, pathname])

  const displayName = teacher?.name?.trim() || (locale === "es" ? "Profesor" : "Professor")
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")

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
        ref={(node) => {
          sidebarRef.current = node
        }}
        className={`
          fixed z-40
          top-6 left-4
          w-72 ${collapsed ? "md:w-[104px] p-3 md:p-4" : "md:w-72 p-6"} h-[calc(100vh-3rem)]
          transform transition-all duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-[300px] md:translate-x-0"}

          bg-cyan-800/10 backdrop-blur-2xl
          border border-white/20
          rounded-2xl shadow-2xl shadow-black/20

          flex flex-col
        `}
      >
        {/* TOPO: LOGO + PERFIL */}
        <div className={`flex ${collapsed ? "flex-col items-center" : "items-center justify-between"} mb-8 gap-2`}>
          <Link
              href="/portal/dashboard"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 group ${collapsed ? "justify-center" : ""}`}
              title="Blue World 9"
            >
              {!logoError ? (
                <Image
                  src={logoSrc}
                  alt="Blue World 9"
                  width={collapsed ? 76 : 140}
                  height={collapsed ? 24 : 40}
                  priority
                  className={`object-contain w-auto transition-opacity group-hover:opacity-90 ${
                    collapsed ? "max-h-8" : "max-h-10 sm:max-h-12"
                  }`}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className={`text-white font-bold ${collapsed ? "text-xs" : "text-sm"}`}>
                  Blue World 9
                </span>
              )}
            </Link>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="hidden md:inline-flex w-9 h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 items-center justify-center transition-colors"
            aria-label={collapsed ? "Expandir menu lateral" : "Comprimir menu lateral"}
            title={collapsed ? "Expandir menu lateral" : "Comprimir menu lateral"}
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>

          <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "gap-2"}`}>
            <Link
              href="/portal/dashboard/notificacoes"
              onClick={() => setOpen(false)}
              className="relative w-9 h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 flex items-center justify-center transition-colors"
              aria-label={t.menu.notificacoes}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && !unreadLoading && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

          {/* Perfil + dropdown */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 
              hover:bg-white/10 transition-colors border border-white/10"
              aria-label="Perfil"
              title={displayName}
            >
              {/* Avatar */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/15 bg-white/10 flex items-center justify-center">
                {teacher?.avatarUrl && !avatarError ? (
                  <img
                    src={teacher.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="text-xs font-semibold text-white/80">{initials || "BW"}</span>
                )}
              </div>

              {!collapsed ? (
                <ChevronDown
                  className={`w-4 h-4 text-white/70 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                />
              ) : null}
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl border border-white/15 
                bg-slate-950/90 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-sm text-white font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-white/50 truncate">
                    {isAdmin ? "Admin" : locale === "es" ? "Profesor" : "Professor"}
                  </p>
                </div>

                <Link
                  href="/portal/dashboard/perfil"
                  onClick={() => {
                    setProfileOpen(false)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  <UserRound className="w-4 h-4" />
                  {t.profile}
                </Link>

                <form action="/api/portal/logout" method="POST">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.logout}
                  </button>
                </form>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* MENU DO PROFESSOR */}
        <nav className={`flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto ${collapsed ? "" : "pr-1"}`}>
          {teacherMenu.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                title={item.label}
                className={`
                  flex items-center ${collapsed ? "justify-center" : ""} gap-2.5 ${collapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-[13px] font-medium
                  transition-all duration-300
                  ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 shadow-md shadow-cyan-500/10"
                      : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {!collapsed ? item.label : null}
              </Link>
            )
          })}

          {/* SEÇÃO ADMIN */}
          {adminMenu.length > 0 && (
            <>
              <div className="my-4 border-t border-white/20" />

              {!collapsed ? (
                <h3 className="text-xs uppercase tracking-wider text-white/50 mb-2 pl-2">
                  {t.adminSection}
                </h3>
              ) : null}

              {adminMenu.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                const hasPendingRelations =
                  item.href === "/portal/dashboard/admin/bug-reports" &&
                  pendingRelationsCount > 0 &&
                  !pendingRelationsLoading

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    title={item.label}
                    className={`
                      flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2.5 ${collapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-[13px] font-medium
                      transition-all duration-300
                      ${
                        active
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/20 shadow-md shadow-purple-500/10"
                          : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
                      }
                    `}
                  >
                    <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "justify-center" : ""}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </div>
                    {hasPendingRelations && !collapsed && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold">
                        {pendingRelationsCount > 99 ? "99+" : pendingRelationsCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        <div className={`mt-4 pt-4 border-t border-white/10 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 text-xs text-white/60`}>
          <Link
            href="/portal/dashboard/relatar-problema"
            onClick={() => setOpen(false)}
            title={t.menu.reportBug}
            className={`flex items-center ${collapsed ? "justify-center" : ""} gap-2 hover:text-white transition-colors`}
          >
            <Bug className="w-4 h-4" />
            {!collapsed ? t.menu.reportBug : null}
          </Link>
          {!collapsed ? <span className="text-[10px] text-white/40">v{systemVersion ?? "dev"}</span> : null}
        </div>
      </aside>

      {/* Overlay mobile */}
      {open && <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />}
    </>
  )
}

