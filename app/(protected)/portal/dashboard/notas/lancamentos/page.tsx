import { requireTeacherPage } from "@/lib/auth/server"
import LancamentosClient from "./LancamentosClient"

export default async function NotasLancamentosPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"

  return <LancamentosClient locale={locale} />
}
