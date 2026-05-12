"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Locale = "pt-BR" | "es"

export default function NotasSectionNav({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  const isEs = locale === "es"
  const normalizedPathname = pathname?.replace(/\/+$/, "") || "/"

  const items = [
    { href: "/portal/dashboard/notas", label: isEs ? "Vision general" : "Visao geral" },
    {
      href: "/portal/dashboard/notas/lancamentos",
      label: isEs ? "Clases" : "Aulas",
    },
  ]

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/35 p-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isOverview = item.href === "/portal/dashboard/notas"
          const active = isOverview
            ? normalizedPathname === item.href
            : normalizedPathname === item.href || normalizedPathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                active
                  ? "bg-cyan-600 text-white"
                  : "bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
