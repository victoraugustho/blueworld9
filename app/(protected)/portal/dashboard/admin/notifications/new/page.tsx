import NotificationForm from "../NotificationForm"
import { requireAdminPage } from "@/lib/auth/server"
import { canCreateSpecialNotification } from "@/lib/notifications"

export default async function NewNotificationPage() {
  const teacher = await requireAdminPage()
  const canManageSpecial = canCreateSpecialNotification(teacher.id)
  return <NotificationForm canManageSpecial={canManageSpecial} />
}
