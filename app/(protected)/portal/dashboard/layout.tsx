import { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { PortalSidebar } from "@/components/portal/PortalSidebar"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const teacherId = cookieStore.get("teacher_id")?.value

  if (!teacherId) redirect("/portal/login")

  const [teacher] = await db`
    SELECT id, name, email, approved, active, locale, role
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `

  if (!teacher || teacher.approved !== true || teacher.active === false) {
    redirect("/portal/login")
  }

  const isAdmin = teacher.role === "admin"
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return (
    <div className="min-h-screen flex">
      <PortalSidebar isAdmin={isAdmin} locale={locale} />

      <main className="flex-1 p-10 ml-0 lg:ml-72 transition-all">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-white">
            {locale === "es" ? "Bienvenido(a)," : "Bem-vindo(a),"} {teacher.name}
          </h1>
          <p className="text-slate-400">{teacher.email}</p>
        </header>

        {children}
      </main>
    </div>
  )
}
