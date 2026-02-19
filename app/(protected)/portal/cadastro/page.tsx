import { redirect } from "next/navigation"
import { getTeacherFromSession } from "@/lib/auth/server"
import { CadastroClient } from "./CadastroClient"

export default async function PortalCadastroPage() {
  const teacher = await getTeacherFromSession()
  if (teacher) {
    redirect("/portal/dashboard")
  }
  return <CadastroClient />
}
