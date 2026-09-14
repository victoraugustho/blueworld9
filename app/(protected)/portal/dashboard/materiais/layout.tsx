import type { ReactNode } from "react"
import { requireTeacherPermissionPage } from "@/lib/auth/server"

export default async function MateriaisLayout({ children }: { children: ReactNode }) {
  await requireTeacherPermissionPage("materiais")
  return children
}

