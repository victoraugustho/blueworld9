"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Item = {
  href: string
  label: string
}

export default function TeacherInfoSubnav({ teacherId }: { teacherId: string }) {
  const pathname = usePathname()

  const items: Item[] = [
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info`, label: "KPIs" },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/atividade`, label: "Atividade" },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/agenda`, label: "Agenda" },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/aulas`, label: "Aulas" },
    { href: `/portal/dashboard/admin/teachers/${teacherId}/info/notas`, label: "Turmas e notas" },
  ]

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              active
                ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-100"
                : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
