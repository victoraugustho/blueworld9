import { requireTeacherPage } from "@/lib/auth/server"
import { AIChatPanel } from "./AiChatPanel"
import { AIProfessorTips } from "./AIProfessorTips"
import { getEffectivePortalLocale } from "@/lib/portal-locale"

export default async function PortalIAPage() {
  const teacher = await requireTeacherPage()
  const locale = await getEffectivePortalLocale(teacher)
  const mode = teacher.role === "admin" || teacher.is_admin === true ? "admin" : "teacher"

  return (
    <div className="p-6 space-y-6">
      <AIProfessorTips locale={locale} />
      <AIChatPanel locale={locale} mode={mode} />
    </div>
  )
}

