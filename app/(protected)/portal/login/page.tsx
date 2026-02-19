import { redirect } from "next/navigation"
import { getTeacherFromSession } from "@/lib/auth/server"
import { LoginClient } from "./LoginClient"

export default async function PortalLoginPage() {
  const teacher = await getTeacherFromSession()
  if (teacher) {
    redirect("/portal/dashboard")
  }
  return <LoginClient />
}
