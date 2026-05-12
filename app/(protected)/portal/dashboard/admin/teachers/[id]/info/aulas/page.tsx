import TeacherLessonsClient from "./TeacherLessonsClient"

type RouteParams = { id: string }

export default async function TeacherLessonsPage({
  params,
}: {
  params: Promise<RouteParams> | RouteParams
}) {
  const resolved = await params
  const teacherId = resolved?.id ?? ""

  return <TeacherLessonsClient teacherId={teacherId} />
}
