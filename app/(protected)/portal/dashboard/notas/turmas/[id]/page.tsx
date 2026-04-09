import { requireTeacherPage } from "@/lib/auth/server"
import TurmaDetalheClient from "./TurmaDetalheClient"

type Params = {
  params: Promise<{ id: string }>
}

export default async function NotasTurmaDetalhePage({ params }: Params) {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  const isAdmin = teacher.is_admin === true || teacher.role === "admin"
  const resolved = await params

  return <TurmaDetalheClient locale={locale} classId={String(resolved?.id ?? "")} isAdmin={isAdmin} />
}
