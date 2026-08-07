import { requireTeacherPage } from "@/lib/auth/server"
import LancamentosClient from "./LancamentosClient"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

export default async function NotasLancamentosPage() {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)
  const scoreMax = teacher.country === "PY" ? 5 : 10

  return (
    <LancamentosClient
      locale={locale}
      scoreMax={scoreMax}
      canDownload={teacher.can_download !== false}
    />
  )
}
