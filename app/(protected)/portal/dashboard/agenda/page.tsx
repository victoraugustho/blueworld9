import { requireTeacherPage } from "@/lib/auth/server"
import AgendaClient from "./AgendaClient"

export default async function AgendaPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <AgendaClient locale={locale} />
}
