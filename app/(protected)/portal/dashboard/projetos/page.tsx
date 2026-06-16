import TeacherProjectsClient from "./TeacherProjectsClient"
import { requireTeacherPage } from "@/lib/auth/server"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

export default async function TeacherProjectsPage() {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)
  return <TeacherProjectsClient locale={locale} />
}

