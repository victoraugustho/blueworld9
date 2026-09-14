import type { ReactNode } from "react"
import { requireTeacherPermissionPage } from "@/lib/auth/server"

export default async function NotasLayout({ children }: { children: ReactNode }) {
  await requireTeacherPermissionPage("agenda_notas")
  return children
}

