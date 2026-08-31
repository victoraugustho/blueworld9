import { redirect } from "next/navigation"
import { requireTeacherPage } from "@/lib/auth/server"
import { isAdminUser } from "@/lib/auth/authorization"

export default async function NotasTurmasPage() {
  const teacher = await requireTeacherPage()
  const isAdmin = isAdminUser(teacher)

  if (isAdmin) {
    redirect("/portal/dashboard/admin/schedules")
  }

  redirect("/portal/dashboard/notas/lancamentos")
}
