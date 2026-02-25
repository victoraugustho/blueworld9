import type React from "react"
import { redirect } from "next/navigation"
import { getTeacherFromSession } from "@/lib/auth/server"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const teacher = await getTeacherFromSession()
  if (teacher && teacher.approved === true && teacher.active !== false) {
    redirect("/portal/dashboard")
  }

  return <div>{children}</div>
}
