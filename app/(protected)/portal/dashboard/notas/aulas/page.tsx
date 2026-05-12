import { redirect } from "next/navigation"

export default async function NotasAulasPage() {
  redirect("/portal/dashboard/notas/lancamentos")
}
