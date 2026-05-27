import ProjectDetailClient from "./ProjectDetailClient"
import { requireTeacherPage } from "@/lib/auth/server"

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const teacher = await requireTeacherPage()
  const { id } = await params
  const locale: "pt-BR" | "es" = teacher.locale === "es" ? "es" : "pt-BR"
  return <ProjectDetailClient projectId={id} locale={locale} />
}

