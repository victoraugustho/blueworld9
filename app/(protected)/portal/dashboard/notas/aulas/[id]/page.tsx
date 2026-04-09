import { requireTeacherPage } from "@/lib/auth/server"
import AulaDetalheClient from "./AulaDetalheClient"

type Params = {
  params: Promise<{ id: string }>
}

export default async function NotasAulaDetalhePage({ params }: Params) {
  const teacher = await requireTeacherPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  const resolved = await params

  return <AulaDetalheClient locale={locale} lessonId={String(resolved?.id ?? "")} />
}
