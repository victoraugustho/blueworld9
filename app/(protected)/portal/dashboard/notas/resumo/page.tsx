import { requireTeacherPage } from "@/lib/auth/server"
import ResumoClient from "./ResumoClient"

export default async function NotasResumoPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <ResumoClient locale={locale} />
}
