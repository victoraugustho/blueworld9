import { redirect } from "next/navigation"
import { requireTeacherPage } from "@/lib/auth/server"
import { BUG_REPORTS_OWNER_ID } from "@/lib/bug-reports"
import BugReportsClient from "./BugReportsClient"

export default async function BugReportsPage() {
  const teacher = await requireTeacherPage()

  if (teacher.id !== BUG_REPORTS_OWNER_ID) {
    redirect("/portal/dashboard")
  }

  return <BugReportsClient />
}
