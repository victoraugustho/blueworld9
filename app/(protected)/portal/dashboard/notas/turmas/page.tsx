import { redirect } from "next/navigation"
import { requireTeacherPage } from "@/lib/auth/server"

export default async function NotasTurmasPage() {
  const teacher = await requireTeacherPage()
  const isAdmin = teacher.is_admin === true || teacher.role === "admin"

  if (isAdmin) {
    redirect("/portal/dashboard/admin/schedules")
  }

  redirect("/portal/dashboard/notas/lancamentos")
}

