import { requireAdminPage } from "@/lib/auth/server"
import AdminAgendaClient from "./AdminAgendaClient"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

export default async function AdminAgendaPage() {
  const teacher = await requireAdminPage()
  const locale = await getEffectivePortalLocale(teacher)

  return <AdminAgendaClient locale={locale} />
}
