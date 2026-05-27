import ProjectsAdminClient from "./ProjectsAdminClient"
import { requireProjectAdminPage } from "@/lib/auth/project-admin-server"

export default async function AdminProjectsPage() {
  await requireProjectAdminPage()
  return <ProjectsAdminClient />
}

