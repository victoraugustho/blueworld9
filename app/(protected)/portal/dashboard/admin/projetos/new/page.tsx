import ProjectEditorClient from "../ProjectEditorClient"
import { requireProjectAdminPage } from "@/lib/auth/project-admin-server"

export default async function NewProjectPage() {
  await requireProjectAdminPage()
  return <ProjectEditorClient />
}

