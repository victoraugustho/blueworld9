import ProjectDetailClient from "./ProjectDetailClient"
import { requireTeacherPage } from "@/lib/auth/server"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const teacher = await requireTeacherPage()
  const { id } = await params
  const locale = await getEffectivePortalLocale(teacher)
  return <ProjectDetailClient projectId={id} locale={locale} canDownload={teacher.can_download !== false} />
}
