import TeacherActivityClient from "./TeacherActivityClient"

type RouteParams = { id: string }

export default async function TeacherActivityPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const resolved = await params
  const teacherId = resolved?.id ?? ""

  return <TeacherActivityClient teacherId={teacherId} />
}
