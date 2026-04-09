import { requireTeacherPage } from "@/lib/auth/server"
import TurmasClient from "./TurmasClient"

export default async function NotasTurmasPage() {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  const isAdmin = teacher.is_admin === true || teacher.role === "admin"

  return <TurmasClient locale={locale} isAdmin={isAdmin} />
}
