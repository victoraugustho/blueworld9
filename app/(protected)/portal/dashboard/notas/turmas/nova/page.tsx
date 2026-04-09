import { requireAdminPage } from "@/lib/auth/server"
import NovaTurmaClient from "./NovaTurmaClient"

type Search = {
  searchParams?: Promise<{ teacherId?: string }> | { teacherId?: string }
}

export default async function NotasNovaTurmaPage({ searchParams }: Search) {
  const teacher = await requireAdminPage()
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  const resolvedSearch = searchParams ? await searchParams : {}
  const defaultTeacherId = String(resolvedSearch?.teacherId ?? "").trim()

  return <NovaTurmaClient locale={locale} defaultTeacherId={defaultTeacherId} />
}
