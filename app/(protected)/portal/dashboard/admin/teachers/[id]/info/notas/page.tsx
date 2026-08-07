import TeacherGradebookClient from "./TeacherGradebookClient"

type RouteParams = { id: string }

export default async function TeacherGradebookPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const resolved = await params
  const teacherId = resolved?.id ?? ""

  return <TeacherGradebookClient teacherId={teacherId} />
}
