import { getEffectivePortalLocale } from "@/lib/portal-locale"
﻿import { requireAdminPage } from "@/lib/auth/server"
import AdminTechnicalSchedulingClient from "./AdminTechnicalSchedulingClient"

export default async function AdminTechnicalSchedulingPage() {
  const teacher = await requireAdminPage()
  const locale = await getEffectivePortalLocale(teacher)

  return <AdminTechnicalSchedulingClient locale={locale} />
}


