import TeacherProjectsClient from "./TeacherProjectsClient"
import { requireTeacherPage } from "@/lib/auth/server"

export default async function TeacherProjectsPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  return <TeacherProjectsClient locale={locale} />
}

