import AdminSchedulesPage from "../../../../schedules/page"
import { TeacherScheduleProvider } from "@/components/portal/TeacherScheduleContext"

type RouteParams = { id: string }

export default async function TeacherAgendaPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const resolved = await params
  const teacherId = resolved?.id ?? ""

  return (
    <TeacherScheduleProvider teacherId={teacherId}>
      <AdminSchedulesPage />
    </TeacherScheduleProvider>
  )
}
