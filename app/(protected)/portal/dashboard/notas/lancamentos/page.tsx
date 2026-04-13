import { requireTeacherPage } from "@/lib/auth/server"
import LancamentosClient from "./LancamentosClient"

export default async function NotasLancamentosPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  const scoreMax = teacher.country === "PY" ? 5 : 10

  return <LancamentosClient locale={locale} scoreMax={scoreMax} />
}
