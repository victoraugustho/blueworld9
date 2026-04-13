import { redirect } from "next/navigation"
import { requireTeacherPage } from "@/lib/auth/server"

export default async function AgendaPage() {
  await requireTeacherPage()
  redirect("/portal/dashboard/notas/lancamentos")
}
