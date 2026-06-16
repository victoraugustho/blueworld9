import { requireAdminPage } from "@/lib/auth/server"
import EditTurmaClient from "./EditTurmaClient"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

type Params = {
  params: Promise<{ id: string }>
}

export default async function NotasEditarTurmaPage({ params }: Params) {
  const teacher = await requireAdminPage()
  const locale = await getEffectivePortalLocale(teacher)
  const resolved = await params

  return <EditTurmaClient locale={locale} classId={String(resolved?.id ?? "")} />
}
