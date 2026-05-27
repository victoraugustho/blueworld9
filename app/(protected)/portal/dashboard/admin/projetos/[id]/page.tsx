import ProjectEditorClient from "../ProjectEditorClient"
import { requireProjectAdminPage } from "@/lib/auth/project-admin-server"

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: Props) {
  await requireProjectAdminPage()
  const { id } = await params
  return <ProjectEditorClient projectId={id} />
}

