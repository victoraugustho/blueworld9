import { requireTeacherPage } from "@/lib/auth/server"
import TurmaDetalheClient from "./TurmaDetalheClient"
import { getEffectivePortalLocale } from "@/lib/portal-locale"
import { isAdminUser } from "@/lib/auth/authorization"

type Params = {
  params: Promise<{ id: string }>
}

export default async function NotasTurmaDetalhePage({ params }: Params) {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)
  const isAdmin = isAdminUser(teacher)
  const resolved = await params

  return <TurmaDetalheClient locale={locale} classId={String(resolved?.id ?? "")} isAdmin={isAdmin} />
}
