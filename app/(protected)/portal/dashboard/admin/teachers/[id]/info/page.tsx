import { requireAdminPage } from "@/lib/auth/server"
import TeacherInfoClient from "./TeacherInfoClient"

type RouteParams = { id: string }

export default async function TeacherInfoPage({
  params,
}: {
  params: Promise<RouteParams> | RouteParams
}) {
  await requireAdminPage()
  const resolved = await params
  const id = resolved?.id ?? ""

  return <TeacherInfoClient teacherId={id} />
}
