import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AIChatPanel } from "./AiChatPanel"
import { AIProfessorTips } from "./AIProfessorTips"

export default async function PortalIAPage() {
  const teacherId = (await cookies()).get("teacher_id")?.value
  if (!teacherId) redirect("/portal/login")

  const [teacher] = await db`
    SELECT id, locale, role, approved, active
    FROM teachers
    WHERE id = ${teacherId}
    LIMIT 1
  `
  if (!teacher || teacher.active === false || teacher.approved === false) redirect("/portal/login")

  const locale = (teacher.locale ?? "pt-BR") as "pt-BR" | "es"
  const mode = teacher.role === "admin" ? "admin" : "teacher"

  return (
    <div className="p-6 space-y-6">
      <AIProfessorTips locale={locale} />
      <AIChatPanel locale={locale} mode={mode} />
    </div>
  )
}
