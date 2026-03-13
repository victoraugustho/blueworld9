import { requireTeacherPage } from "@/lib/auth/server"
import ReportBugClient from "./ReportBugClient"

export default async function ReportBugPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <ReportBugClient locale={locale} />
}
