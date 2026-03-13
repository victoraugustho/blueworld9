import { requireAdminPage } from "@/lib/auth/server"
import AdminAgendaClient from "./AdminAgendaClient"

export default async function AdminAgendaPage() {
  const teacher = await requireAdminPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <AdminAgendaClient locale={locale} />
}
