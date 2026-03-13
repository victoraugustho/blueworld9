import { requireAdminPage } from "@/lib/auth/server"
import AdminTechnicalSchedulingClient from "./AdminTechnicalSchedulingClient"

export default async function AdminTechnicalSchedulingPage() {
  const teacher = await requireAdminPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <AdminTechnicalSchedulingClient locale={locale} />
}


