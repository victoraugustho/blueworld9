import { requireAdminPage } from "@/lib/auth/server"
import EditTurmaClient from "./EditTurmaClient"

type Params = {
  params: Promise<{ id: string }>
}

export default async function NotasEditarTurmaPage({ params }: Params) {
  const teacher = await requireAdminPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  const resolved = await params

  return <EditTurmaClient locale={locale} classId={String(resolved?.id ?? "")} />
}
