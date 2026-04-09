import { requireTeacherPage } from "@/lib/auth/server"
import AulasClient from "./AulasClient"

export default async function NotasAulasPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <AulasClient locale={locale} />
}
