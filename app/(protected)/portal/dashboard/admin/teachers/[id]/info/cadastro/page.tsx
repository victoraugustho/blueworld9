import EditTeacherPage from "../../EditTeacher"

type RouteParams = { id: string }

export default async function TeacherRegistrationPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params
  return (
    <EditTeacherPage
      params={{ id }}
      returnHref={`/portal/dashboard/admin/teachers/${id}/info`}
    />
  )
}
