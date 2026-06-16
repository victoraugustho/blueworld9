import { requireTeacherPage } from "@/lib/auth/server"
import ReportBugClient from "./ReportBugClient"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

export default async function ReportBugPage() {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)

  return <ReportBugClient locale={locale} />
}
