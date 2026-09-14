import type { ReactNode } from "react"
import { requireTeacherPermissionPage } from "@/lib/auth/server"

export default async function ProjetosLayout({ children }: { children: ReactNode }) {
  await requireTeacherPermissionPage("projetos")
  return children
}

