import type { ReactNode } from "react"
import { requireTeacherPermissionPage } from "@/lib/auth/server"

export default async function IaLayout({ children }: { children: ReactNode }) {
  await requireTeacherPermissionPage("ia")
  return children
}

