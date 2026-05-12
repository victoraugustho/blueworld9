import NotificationForm from "../../NotificationForm"
import { requireAdminPage } from "@/lib/auth/server"
import { canCreateSpecialNotification } from "@/lib/notifications"

type PageProps = { params: Promise<{ id: string }> }

export default async function EditNotificationPage({ params }: PageProps) {
  const teacher = await requireAdminPage()
  const canManageSpecial = canCreateSpecialNotification(teacher.id)
  const { id } = await params
  return <NotificationForm id={id} canManageSpecial={canManageSpecial} />
}
