"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, CalendarDays, ChartNoAxesCombined, ClipboardPen, GraduationCap, UserRoundCog } from "lucide-react"

type Item = {
  href: string
  label: string
  icon: typeof Activity
}

export default function TeacherInfoSubnav({ teacherId }: { teacherId: string }) {
  const pathname = usePathname()

  const items: Item[] = [
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info`, label: "Visão geral", icon: ChartNoAxesCombined },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/cadastro`, label: "Cadastro e acesso", icon: UserRoundCog },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/agenda`, label: "Gestão e agenda", icon: CalendarDays },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/notas`, label: "Notas", icon: GraduationCap },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/aulas`, label: "Aulas", icon: ClipboardPen },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/atividade`, label: "Atividade", icon: Activity },
  ]

  return (
    <nav className="mb-6 grid grid-cols-2 sm:flex sm:flex-wrap gap-2" aria-label="Gestão do professor">
      {items.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center justify-center sm:justify-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
              active
                ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-100"
                : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
