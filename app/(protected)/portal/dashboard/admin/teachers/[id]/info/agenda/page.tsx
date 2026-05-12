import TeacherAgendaClient from "./TeacherAgendaClient"

type RouteParams = { id: string }

export default async function TeacherAgendaPage({
  params,
}: {
  params: Promise<RouteParams> | RouteParams
}) {
  const resolved = await params
  const teacherId = resolved?.id ?? ""

  return <TeacherAgendaClient teacherId={teacherId} />
}
