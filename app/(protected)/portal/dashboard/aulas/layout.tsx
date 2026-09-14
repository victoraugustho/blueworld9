import type { ReactNode } from "react"
import { requireTeacherPermissionPage } from "@/lib/auth/server"

export default async function AulasLayout({ children }: { children: ReactNode }) {
  await requireTeacherPermissionPage("aulas")
  return children
}

